# Phase 1: Replace inline header/footer/scroll elements with mount points
# and add components.js script tag to all HTML files.

$files = Get-ChildItem -Filter *.html

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $modified = $false

    # 1. Replace scroll-progress div with mount point
    if ($content -match '<div class="scroll-progress" id="scrollProgress"></div>') {
        $content = $content -replace '<div class="scroll-progress" id="scrollProgress"></div>', '<div id="scroll-progress-mount"></div>'
        $modified = $true
    }

    # 2. Replace header block with mount point
    # Match from <header class="header" to </header>
    $headerPattern = '(?s)\s*<header class="header" id="siteHeader">.*?</header>'
    if ($content -match $headerPattern) {
        $content = [regex]::Replace($content, $headerPattern, "`n    <div id=`"header-mount`"></div>")
        $modified = $true
    }

    # 3. Replace footer block with mount point
    # Match from <footer class="footer"> to </footer>
    $footerPattern = '(?s)\s*<footer class="footer">.*?</footer>'
    if ($content -match $footerPattern) {
        $content = [regex]::Replace($content, $footerPattern, "`n    <div id=`"footer-mount`"></div>")
        $modified = $true
    }

    # 4. Replace scroll-top button with mount point
    $scrollTopPattern = '(?s)\s*<button type="button" class="scroll-top" id="scrollTopButton"[^>]*>.*?</button>'
    if ($content -match $scrollTopPattern) {
        $content = [regex]::Replace($content, $scrollTopPattern, "`n    <div id=`"scroll-top-mount`"></div>")
        $modified = $true
    }

    # 5. Add components.js script BEFORE main.js (if not already there)
    if ($content -notmatch 'components\.js') {
        # Insert components.js right before the main.js script tag
        $content = $content -replace '(<script src="js/main\.js)', '    <script src="js/components.js?v=2.0"></script>' + "`n" + '    $1'
        $modified = $true
    }

    # 6. Update CSP to allow components.js (it's same-origin 'self', so no change needed)

    if ($modified) {
        Set-Content -Path $file.FullName -Value $content -Encoding UTF8
        Write-Host "Componentized: $($file.Name)"
    } else {
        Write-Host "Skipped (already done): $($file.Name)"
    }
}

Write-Host ""
Write-Host "Phase 1 complete. Header, footer, scroll-progress, and scroll-top"
Write-Host "are now injected from js/components.js via mount points."
