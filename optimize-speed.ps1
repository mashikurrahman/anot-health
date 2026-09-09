$files = Get-ChildItem -Filter *.html

$fontTags = @"
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700;800&display=swap" rel="stylesheet">
"@

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw

    # 1. Add Font Preconnect and stylesheet links before </head> if not already there
    if ($content -notmatch "fonts.googleapis.com/css2") {
        $content = $content -replace "(?i)(</head>)", "$fontTags`n    `$1"
    }

    # 2. Add defer to main.js if not already deferred
    if ($content -match '<script src="js/main.js"></script>') {
        $content = $content -replace '<script src="js/main.js"></script>', '<script src="js/main.js" defer></script>'
    }

    # 3. Add loading="lazy" to images that don't have it and don't have fetchpriority="high"
    # We do a basic regex to add loading="lazy" to imgs missing it
    # We will use a regex evaluator to do this safely
    $content = [regex]::Replace($content, '(?i)<img([^>]+)>', {
        param($m)
        $attrs = $m.Groups[1].Value
        if ($attrs -match 'fetchpriority="high"') {
            # Don't lazy load LCP images
            return "<img$attrs>"
        }
        if ($attrs -notmatch 'loading="lazy"') {
            return "<img$attrs loading=""lazy"">"
        }
        return $m.Value
    })

    Set-Content -Path $file.FullName -Value $content -Encoding UTF8
    Write-Host "Optimized $($file.Name)"
}
