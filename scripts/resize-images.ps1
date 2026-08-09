# Resizes/compresses product photos referenced in data/name-stickers.json for web use.
# No Python/Node available, so this uses .NET System.Drawing directly.
# Run manually with: powershell -File scripts/resize-images.ps1

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

# Raw material folders live under 04_group_photo\NN_category-name\ (numbered to match
# the website's category order) - located by the "01" prefix rather than the Chinese
# name, since Windows PowerShell 5.1 mangles non-ASCII literals in unsigned .ps1 source.
$root = Split-Path -Parent $PSScriptRoot
$parentDir = Split-Path -Parent $root
$stickerRoot = (Get-ChildItem -Path $parentDir -Directory | Where-Object { $_.Name -match '^0?1[_\-]' } | Select-Object -First 1).FullName
$srcDir = (Get-ChildItem -Path $stickerRoot -Directory | Select-Object -First 1).FullName
$destDir = Join-Path $root "assets\images\name-stickers"

if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }

$dataText = [System.IO.File]::ReadAllText((Join-Path $root "data\name-stickers.json"), [System.Text.Encoding]::UTF8)
$records = $dataText | ConvertFrom-Json
$imageNames = @($records | Where-Object { $_.image } | ForEach-Object { $_.image })
$imageNames += @($records | Where-Object { $_.giftImage } | ForEach-Object { $_.giftImage })
$imageNames = $imageNames | Sort-Object -Unique

$maxWidth = 800
$jpegQuality = 78

$codecInfo = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$encParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [int64]$jpegQuality)

$done = 0
$skipped = 0
foreach ($name in $imageNames) {
    $srcPath = Join-Path $srcDir $name
    $destPath = Join-Path $destDir $name
    if (-not (Test-Path $srcPath)) { $skipped++; continue }

    $img = [System.Drawing.Image]::FromFile($srcPath)
    try {
        $ratio = [Math]::Min(1.0, $maxWidth / $img.Width)
        $newW = [int]([Math]::Round($img.Width * $ratio))
        $newH = [int]([Math]::Round($img.Height * $ratio))

        $bmp = New-Object System.Drawing.Bitmap($newW, $newH)
        try {
            $g = [System.Drawing.Graphics]::FromImage($bmp)
            try {
                $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $g.DrawImage($img, 0, 0, $newW, $newH)
            } finally { $g.Dispose() }
            $bmp.Save($destPath, $codecInfo, $encParams)
            $done++
        } finally { $bmp.Dispose() }
    } finally { $img.Dispose() }
}

Write-Output "Resized $done images into assets/images/name-stickers ($skipped source files not found)"
