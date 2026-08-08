# Adds a "giftBag" flag to data/name-stickers.json based on the source photo folder naming rule:
# a file named "NNN-NNN.jpg" (pair/range) or "NNN-1.jpg" (variant) means those ID(s) come with
# a free cute bag ("送可愛包"), per the shop owner's rule.
# Run manually with: powershell -File scripts/add-gift-bag-flag.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$parentDir = Split-Path -Parent $root
$imgDir = (Get-ChildItem -Path $parentDir -Directory | Where-Object { $_.Name -ne "website" } | Select-Object -First 1).FullName
$actualFiles = Get-ChildItem -Path $imgDir -Filter "*.jpg" | ForEach-Object { $_.Name }

$giftIds = New-Object 'System.Collections.Generic.HashSet[string]'
foreach ($f in $actualFiles) {
    if ($f -match '^(\d{3})-(\d{3})\.jpg$') {
        $lo = [int]$matches[1]
        $hi = [int]$matches[2]
        if ($hi -ge $lo -and ($hi - $lo) -le 10) {
            for ($n = $lo; $n -le $hi; $n++) { [void]$giftIds.Add("$n") }
        }
    } elseif ($f -match '^(\d{3})-1\.jpg$') {
        [void]$giftIds.Add($matches[1])
    }
}

$dataPath = Join-Path $root "data\name-stickers.json"
$dataText = [System.IO.File]::ReadAllText($dataPath, [System.Text.Encoding]::UTF8)
$records = $dataText | ConvertFrom-Json

foreach ($rec in $records) {
    $hasGift = $giftIds.Contains($rec.id)
    $rec | Add-Member -NotePropertyName "giftBag" -NotePropertyValue $hasGift -Force
}

$json = $records | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($dataPath, $json, (New-Object System.Text.UTF8Encoding($false)))

Write-Output "Gift-bag source files found: $($giftIds.Count) IDs"
Write-Output "Flagged $((@($records | Where-Object { $_.giftBag })).Count) records with giftBag=true"
