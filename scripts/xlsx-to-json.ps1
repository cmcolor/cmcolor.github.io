# Converts the product catalog xlsx into data/name-stickers.json
# No Python/Node available on this machine, so we parse the raw xlsx (a zip of XML) directly via .NET.
# Run manually with: powershell -File scripts/xlsx-to-json.ps1
# Note: avoid embedding non-ASCII literals in this file - Windows PowerShell 5.1
# reads .ps1 source using the system codepage when there's no BOM, which mangles them.
# Any Chinese-text matching (e.g. detecting "sold out") is done in JS at render time instead.

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = Split-Path -Parent $PSScriptRoot
$parentDir = Split-Path -Parent $root
$xlsxPath = (Get-ChildItem -Path $parentDir -Filter "*.xlsx" | Select-Object -First 1).FullName
$extractDir = Join-Path $env:TEMP "qunmei_xlsx_extract"

if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force }
[System.IO.Compression.ZipFile]::ExtractToDirectory($xlsxPath, $extractDir)

$sstText = [System.IO.File]::ReadAllText("$extractDir\xl\sharedStrings.xml", [System.Text.Encoding]::UTF8)
[xml]$sstXml = $sstText
$strings = @($sstXml.sst.si | ForEach-Object {
    if ($_.t -is [string]) { $_.t } elseif ($_.t) { $_.t.InnerText } else { "" }
})

$sheetText = [System.IO.File]::ReadAllText("$extractDir\xl\worksheets\sheet1.xml", [System.Text.Encoding]::UTF8)
[xml]$sheetXml = $sheetText
$ns = New-Object System.Xml.XmlNamespaceManager($sheetXml.NameTable)
$ns.AddNamespace("m", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
$rows = $sheetXml.SelectNodes("//m:sheetData/m:row", $ns)

function Get-CellValue($cellNode) {
    if ($null -eq $cellNode) { return "" }
    $v = $cellNode.v
    if ($null -eq $v) { return "" }
    if ($cellNode.t -eq "s") { return $strings[[int]$v] }
    return $v
}

function Get-ColLetter($ref) {
    return ($ref -replace '\d', '')
}

$records = @()
$qaFlags = @()

foreach ($row in $rows) {
    $rowNum = [int]$row.r
    if ($rowNum -eq 1) { continue } # header row

    $cellsByCol = @{}
    foreach ($c in $row.c) {
        $col = Get-ColLetter $c.r
        $cellsByCol[$col] = $c
    }

    $id = Get-CellValue $cellsByCol["A"]
    if ([string]::IsNullOrWhiteSpace([string]$id)) { continue }

    $category = Get-CellValue $cellsByCol["B"]
    $name = Get-CellValue $cellsByCol["C"]
    $size = Get-CellValue $cellsByCol["D"]
    $dimensions = Get-CellValue $cellsByCol["E"]
    $sheetCount = Get-CellValue $cellsByCol["F"]
    $price = Get-CellValue $cellsByCol["G"]
    $note = Get-CellValue $cellsByCol["H"]
    $image = Get-CellValue $cellsByCol["I"]
    $pending = Get-CellValue $cellsByCol["J"]

    $extra = @{}
    foreach ($col in @("K", "L", "M")) {
        if ($cellsByCol.ContainsKey($col)) {
            $extra[$col] = Get-CellValue $cellsByCol[$col]
        }
    }

    $records += [PSCustomObject]@{
        id         = "$id"
        category   = $category
        name       = $name
        size       = $size
        dimensions = $dimensions
        sheetCount = $sheetCount
        price      = $price
        note       = $note
        image      = $image
    }

    if (-not [string]::IsNullOrWhiteSpace($pending) -or $extra.Count -gt 0) {
        $qaFlags += [PSCustomObject]@{
            row      = $rowNum
            id       = "$id"
            name     = $name
            pending  = $pending
            extraCols = $extra
        }
    }
}

# --- Resolve image filenames against what actually exists on disk ---
# The xlsx's 圖片檔名 column sometimes names a file that was never saved standalone;
# in some cases the real photo is a combined "NNN-NNN.jpg" covering a small range of
# consecutive IDs. We only auto-resolve that specific, unambiguous pattern (both sides
# look like real 3-digit catalog IDs) - anything else is left blank and reported,
# per the plan: no silent guessing on data quality issues.
$imgDir = (Get-ChildItem -Path $parentDir -Directory | Where-Object { $_.Name -ne "website" } | Select-Object -First 1).FullName
$actualFiles = Get-ChildItem -Path $imgDir -Filter "*.jpg" | ForEach-Object { $_.Name }
$actualSet = New-Object 'System.Collections.Generic.HashSet[string]'
foreach ($f in $actualFiles) { [void]$actualSet.Add($f) }

$rangeMap = @{}
foreach ($f in $actualFiles) {
    if ($f -match '^(\d{3})-(\d{3})\.jpg$') {
        $lo = [int]$matches[1]
        $hi = [int]$matches[2]
        if ($hi -ge $lo -and ($hi - $lo) -le 10) {
            for ($n = $lo; $n -le $hi; $n++) {
                $rangeMap["$n"] = $f
            }
        }
    }
}

$missingImages = @()
foreach ($rec in $records) {
    if ([string]::IsNullOrWhiteSpace($rec.image) -or -not $actualSet.Contains($rec.image)) {
        if ($rangeMap.ContainsKey($rec.id)) {
            $rec.image = $rangeMap[$rec.id]
        } else {
            $missingImages += [PSCustomObject]@{ id = $rec.id; name = $rec.name; category = $rec.category; expectedFile = $rec.image }
            $rec.image = ""
        }
    }
}

$outDir = Join-Path $root "data"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

$json = $records | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText((Join-Path $outDir "name-stickers.json"), $json, (New-Object System.Text.UTF8Encoding($false)))

$qaReport = [PSCustomObject]@{
    pendingFlags  = $qaFlags
    missingImages = $missingImages
}
$qaJson = $qaReport | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText((Join-Path $outDir "qa-report.json"), $qaJson, (New-Object System.Text.UTF8Encoding($false)))

Write-Output "Wrote $($records.Count) records to data/name-stickers.json"
Write-Output "Auto-resolved $($rangeMap.Count -gt 0) range-combo images where applicable"
Write-Output "Missing images: $($missingImages.Count) (see data/qa-report.json)"
Write-Output "Pending flags from xlsx: $($qaFlags.Count) (see data/qa-report.json)"
