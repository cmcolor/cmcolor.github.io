# Adds "giftBag"/"giftImage" fields to data/name-stickers.json based on the source photo
# folder naming rule: a file named "NNN-NNN.jpg" (pair/range) or "NNN-1.jpg" (variant) is
# itself a photo of the free cute bag ("送可愛包") that ID comes with, per the shop owner's rule.
# Run manually with: powershell -File scripts/add-gift-bag-flag.ps1

# Raw material folders live under 04_group_photo\NN_category-name\ (numbered to match
# the website's category order) - located by the "01" prefix rather than the Chinese
# name, since Windows PowerShell 5.1 mangles non-ASCII literals in unsigned .ps1 source.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$parentDir = Split-Path -Parent $root
$stickerRoot = (Get-ChildItem -Path $parentDir -Directory | Where-Object { $_.Name -match '^0?1[_\-]' } | Select-Object -First 1).FullName
$imgDir = (Get-ChildItem -Path $stickerRoot -Directory | Select-Object -First 1).FullName
$actualFiles = Get-ChildItem -Path $imgDir -Filter "*.jpg" | ForEach-Object { $_.Name }

$giftImageById = @{}
foreach ($f in $actualFiles) {
    if ($f -match '^(\d{3})-(\d{3})\.jpg$') {
        $lo = [int]$matches[1]
        $hi = [int]$matches[2]
        if ($hi -ge $lo -and ($hi - $lo) -le 10) {
            for ($n = $lo; $n -le $hi; $n++) { $giftImageById["$n"] = $f }
        }
    } elseif ($f -match '^(\d{3})-1\.jpg$') {
        $giftImageById[$matches[1]] = $f
    }
}

$dataPath = Join-Path $root "data\name-stickers.json"
$dataText = [System.IO.File]::ReadAllText($dataPath, [System.Text.Encoding]::UTF8)
$records = $dataText | ConvertFrom-Json

foreach ($rec in $records) {
    $giftImg = $giftImageById[$rec.id]
    $rec | Add-Member -NotePropertyName "giftBag" -NotePropertyValue ([bool]$giftImg) -Force
    $rec | Add-Member -NotePropertyName "giftImage" -NotePropertyValue ($(if ($giftImg) { $giftImg } else { "" })) -Force
}

$json = $records | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($dataPath, $json, (New-Object System.Text.UTF8Encoding($false)))

Write-Output "Gift-bag source files found: $($giftImageById.Count) IDs"
Write-Output "Flagged $((@($records | Where-Object { $_.giftBag })).Count) records with giftBag=true"
