$files = @(
    @{ name='scribing.html'; title='Medical AI Scribing | Anot Health'; desc='High-tech ambient AI scribing with expert human validation. Reduce documentation time by 80%.' },
    @{ name='billing.html'; title='Medical AI Billing | Anot Health'; desc='Autonomous medical billing and revenue protection. Maximize your collections with 100% accurate AI.' },
    @{ name='coding.html'; title='Medical AI Coding | Anot Health'; desc='Intelligent AI medical coding with zero hallucination guarantee. Expert-validated coding for clinical perfection.' }
)

$base = 'c:\Users\Video Editor\Documents\Anti Projects\Anot Health'

foreach ($f in $files) {
    $path = Join-Path $base $f.name
    $c = Get-Content $path -Raw
    
    # Update SEO
    $c = $c -replace '<title>.*</title>', "<title>$($f.title)</title>"
    $c = $c -replace '<meta name="description" content=".*">', "<meta name='description' content='$($f.desc)'>"
    
    # Update Script Section
    $newScript = @"
        // ── Advanced Intersection Observer (Enter/Exit) ──
        const revealEls = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');
        const revealObs = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                const rect = e.boundingClientRect;
                if (e.isIntersecting) {
                    e.target.classList.add('visible');
                    e.target.classList.remove('scrolled-past');
                } else if (rect.top < 0) {
                    e.target.classList.add('scrolled-past');
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -10% 0px' });
        revealEls.forEach(el => revealObs.observe(el));
"@
    
    # This might be tricky if script differs, but let's assume standard structure
    $c = $c -replace '// ── Intersection Observer Reveal ──[\s\S]*?revealEls.forEach\(el => revealObs.observe\(el\)\);', $newScript
    
    Set-Content $path $c -NoNewline
    Write-Host "Updated $($f.name) SEO & Scripts"
}
