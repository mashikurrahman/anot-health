$files = Get-ChildItem -Filter *.html

$ogMeta = @"
    <!-- Open Graph / Social Media Meta Tags -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://anot.health/">
    <meta property="og:title" content="Anot Health | Clinical Operations & Revenue Cycle">
    <meta property="og:description" content="Expert-led clinical documentation, coding, billing, and payroll for healthcare teams. The industry's best professionals, armed with advanced AI.">
    <meta property="og:image" content="https://anot.health/images/hero-platform-center.webp">
    
    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="https://anot.health/">
    <meta property="twitter:title" content="Anot Health | Clinical Operations & Revenue Cycle">
    <meta property="twitter:description" content="Expert-led clinical documentation, coding, billing, and payroll for healthcare teams. The industry's best professionals, armed with advanced AI.">
    <meta property="twitter:image" content="https://anot.health/images/hero-platform-center.webp">
"@

$jsonLd = @"
    <!-- Google JSON-LD Structured Data -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "MedicalBusiness",
      "name": "Anot Health",
      "url": "https://anot.health/",
      "logo": "https://anot.health/images/Logo-anot.webp",
      "description": "Expert-led clinical documentation, coding, billing, and payroll for healthcare teams. Amplified by industry-leading AI.",
      "contactPoint": {
        "@type": "ContactPoint",
        "email": "admin@anot.health",
        "contactType": "customer service"
      }
    }
    </script>
"@

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw

    # 1. Inject Open Graph Meta Tags into <head> (if not present)
    if ($content -notmatch "og:title") {
        # Insert before closing </head>
        $content = $content -replace '(?i)(</head>)', "$ogMeta`r`n    `$1"
    }

    # 2. Inject JSON-LD only into index.html
    if ($file.Name -eq "index.html" -and $content -notmatch "application/ld\+json") {
        $content = $content -replace '(?i)(</head>)', "$jsonLd`r`n    `$1"
    }

    Set-Content -Path $file.FullName -Value $content -Encoding UTF8
    Write-Host "Injected SEO into: $($file.Name)"
}
Write-Host "Phase 4 SEO Injection Complete!"
