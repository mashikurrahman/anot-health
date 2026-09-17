param(
    [string]$Version,
    [switch]$UseTimestamp
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$configPath = Join-Path $root 'cache-version.json'

if (Test-Path $configPath) {
    $config = Get-Content $configPath -Raw | ConvertFrom-Json
} else {
    $config = [pscustomobject]@{
        version = ''
        updatedAt = ''
    }
}

if ($UseTimestamp) {
    $Version = Get-Date -Format 'yyyyMMddHHmm'
} elseif (-not $Version) {
    $Version = [string]$config.version
}

if (-not $Version) {
    throw 'No cache version provided. Use -Version 20260520 or -UseTimestamp.'
}

$config.version = $Version
$config.updatedAt = (Get-Date).ToString('s')
$config | ConvertTo-Json | Set-Content -Path $configPath -Encoding UTF8

$targets = @(
    'about.html',
    'billing.html',
    'coding.html',
    'contact.html',
    'hipaa.html',
    'index.html',
    'payroll.html',
    'privacy.html',
    'scribing.html',
    'specialties.html',
    'terms.html',
    'js\components.js'
)

$replacements = @(
    @{ Pattern = 'css/style\.css\?v=[^"\'' ]+'; Replacement = "css/style.css?v=$Version" },
    @{ Pattern = 'js/components\.js\?v=[^"\'' ]+'; Replacement = "js/components.js?v=$Version" },
    @{ Pattern = 'js/main\.js\?v=[^"\'' ]+'; Replacement = "js/main.js?v=$Version" },
    @{ Pattern = 'images/logo-markss\.webp(?:\?v=[^"\'' ]+)?'; Replacement = "images/logo-markss.webp?v=$Version" },
    @{ Pattern = 'images/Logo-anot\.webp(?:\?v=[^"\'' ]+)?'; Replacement = "images/Logo-anot.webp?v=$Version" },
    @{ Pattern = 'images/hero-platform-center\.webp(?:\?v=[^"\'' ]+)?'; Replacement = "images/hero-platform-center.webp?v=$Version" },
    @{ Pattern = 'images/hero-platform-left\.webp(?:\?v=[^"\'' ]+)?'; Replacement = "images/hero-platform-left.webp?v=$Version" },
    @{ Pattern = 'images/hero-platform-right\.webp(?:\?v=[^"\'' ]+)?'; Replacement = "images/hero-platform-right.webp?v=$Version" }
)

foreach ($relativePath in $targets) {
    $filePath = Join-Path $root $relativePath
    if (-not (Test-Path $filePath)) {
        continue
    }

    $content = Get-Content $filePath -Raw
    foreach ($rule in $replacements) {
        $content = [regex]::Replace($content, $rule.Pattern, $rule.Replacement)
    }

    Set-Content -Path $filePath -Value $content -Encoding UTF8
    Write-Host "Updated cache version in $relativePath"
}

Write-Host "Cache version is now $Version"
