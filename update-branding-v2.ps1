$files = @('scribing.html','billing.html','coding.html','about.html','specialties.html','contact.html')
$base = 'c:\Users\Video Editor\Documents\Anti Projects\Anot Health'

$headerReplace = @"
    <header class="header" id="siteHeader">
        <div class="header-inner">
            <a href="index.html" class="logo"><img src="images/logo-mark.svg" alt="Anot Health" class="logo-img"></a>
            <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="siteNav" aria-label="Open menu">
                <span class="nav-toggle-line"></span>
                <span class="nav-toggle-line"></span>
                <span class="nav-toggle-line"></span>
            </button>
            <nav class="nav" id="siteNav">
                <ul class="nav-list">
                    <li class="nav-item"><a href="index.html" class="nav-link">Home</a></li>
                    <li class="nav-item nav-item-dropdown">
                        <button class="nav-link nav-link-dropdown nav-dropdown-toggle" type="button" aria-expanded="false">Services <i data-lucide="chevron-down" class="icon-xs nav-caret"></i></button>
                        <ul class="nav-dropdown">
                            <li><a href="scribing.html" class="nav-dropdown-link">Medical Documentation</a></li>
                            <li><a href="billing.html" class="nav-dropdown-link">Billing</a></li>
                            <li><a href="coding.html" class="nav-dropdown-link">Coding</a></li>
                            <li><a href="payroll.html" class="nav-dropdown-link">Payroll Management</a></li>
                        </ul>
                    </li>
                    <li class="nav-item"><a href="about.html" class="nav-link">About</a></li>
                    <li class="nav-item"><a href="contact.html" class="nav-link">Contact Us</a></li>
                    <li><a href="contact.html" class="btn btn-cyan btn-nav-demo">Get a Demo</a></li>
                </ul>
            </nav>
        </div>
    </header>
"@

foreach ($f in $files) {
    $path = Join-Path $base $f
    $c = Get-Content $path -Raw
    
    # Update Background Morph
    if ($c -notlike "*bg-morph*") {
        $c = $c -replace '<body>', "<body>`n    <div class='bg-morph'><div class='blob blob-1'></div><div class='blob blob-2'></div></div>"
    }

    # Replace the header with the current site navigation
    $c = [regex]::Replace($c, '<header class="header" id="siteHeader">[\s\S]*?</header>', $headerReplace, 1)
    
    Set-Content $path $c -NoNewline
    Write-Host "Updated $f"
}
