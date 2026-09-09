# Fix: Insert components.js script tag before main.js in all HTML files

$files = Get-ChildItem -Filter *.html

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw

    if ($content -notmatch 'components\.js') {
        $searchStr = '<script src="js/main.js'
        $replaceStr = '<script src="js/components.js?v=2.0"></script>' + "`r`n" + '    <script src="js/main.js'
        $content = $content.Replace($searchStr, $replaceStr)
        Set-Content -Path $file.FullName -Value $content -Encoding UTF8
        Write-Host "Added components.js to: $($file.Name)"
    } else {
        Write-Host "Already has components.js: $($file.Name)"
    }
}
