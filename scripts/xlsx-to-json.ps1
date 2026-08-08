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

# The xlsx rows are supposed to be in ascending catalog-number order, but a couple of
# rows were out of order in the sheet itself (e.g. 333 listed before 332). Sort by
# numeric id so the site always displays in catalog order regardless of row order.
$records = @($records | Sort-Object { [int]$_.id })

# --- Resolve image filenames against what actually exists on disk ---
# The xlsx's 圖片檔名 column sometimes names a file that was never saved, or names the
# wrong ID (a numbering typo - several rows are self-flagged "編號疑似算錯"). The only
# safe auto-fix is: if the declared filename is missing, but a file matching the row's
# OWN id exists (e.g. id 819 -> "819.jpg"), use that - it's not a guess across different
# products, just correcting the typo back to the row's own id. Anything still missing
# after that is left blank and reported, per the plan: no guessing on data quality issues.
# (We previously also guessed from "NNN-NNN.jpg" combo files, assuming one photo covered
# a whole range of IDs - that turned out wrong for at least 2 products, so it's removed.)
$imgDir = (Get-ChildItem -Path $parentDir -Directory | Where-Object { $_.Name -ne "website" } | Select-Object -First 1).FullName
$actualFiles = Get-ChildItem -Path $imgDir -Filter "*.jpg" | ForEach-Object { $_.Name }
$actualSet = New-Object 'System.Collections.Generic.HashSet[string]'
foreach ($f in $actualFiles) { [void]$actualSet.Add($f) }

$missingImages = @()
foreach ($rec in $records) {
    if ([string]::IsNullOrWhiteSpace($rec.image) -or -not $actualSet.Contains($rec.image)) {
        $selfNamed = "$($rec.id).jpg"
        if ($actualSet.Contains($selfNamed)) {
            $rec.image = $selfNamed
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
Write-Output "Missing images: $($missingImages.Count) (see data/qa-report.json)"
Write-Output "Pending flags from xlsx: $($qaFlags.Count) (see data/qa-report.json)"
