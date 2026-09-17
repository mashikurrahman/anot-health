$ErrorActionPreference = "Stop"

$projectRoot = "d:\Anot Main Website\anot-health-master"
$backendDir = Join-Path $projectRoot "backend"

# 1. Create Backend ZIP
$backendZip = Join-Path $projectRoot "anot-backend-ready.zip"
if (Test-Path $backendZip) { Remove-Item $backendZip -Force }

$backendFiles = @(
    (Join-Path $backendDir "server.js"),
    (Join-Path $backendDir "analyticsService.js"),
    (Join-Path $backendDir "package.json"),
    (Join-Path $backendDir "package-lock.json"),
    (Join-Path $backendDir ".env"),
    (Join-Path $backendDir "service-account.json"),
    (Join-Path $backendDir ".htaccess")
)

Compress-Archive -Path $backendFiles -DestinationPath $backendZip -Force
$bZipItem = Get-Item $backendZip
Write-Host "✅ Created: anot-backend-ready.zip ($([math]::Round($bZipItem.Length / 1KB, 2)) KB)"

# 2. Create Frontend ZIP
$frontendZip = Join-Path $projectRoot "anot-frontend-ready.zip"
if (Test-Path $frontendZip) { Remove-Item $frontendZip -Force }

# Gather all frontend items
$frontendItems = @()

# All HTML files
Get-ChildItem -Path $projectRoot -Filter "*.html" -File | ForEach-Object { $frontendItems += $_.FullName }

# Essential root files
$specialFiles = @(".htaccess", "robots.txt", "sitemap.xml", "site.webmanifest")
foreach ($sf in $specialFiles) {
    $p = Join-Path $projectRoot $sf
    if (Test-Path $p) { $frontendItems += $p }
}

# Essential directories
$folders = @("css", "js", "images", "data")
foreach ($f in $folders) {
    $p = Join-Path $projectRoot $f
    if (Test-Path $p) { $frontendItems += $p }
}

Compress-Archive -Path $frontendItems -DestinationPath $frontendZip -Force
$fZipItem = Get-Item $frontendZip
Write-Host "✅ Created: anot-frontend-ready.zip ($([math]::Round($fZipItem.Length / 1MB, 2)) MB)"
