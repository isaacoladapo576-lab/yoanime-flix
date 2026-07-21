$servers = @(
    "https://vidsrc.me",
    "https://vidsrc.net",
    "https://vidsrc.xyz",
    "https://vidsrc.icu",
    "https://vidsrc.in",
    "https://vidsrc.pm",
    "https://vidsrc.nl",
    "https://www.2embed.cc",
    "https://superembed.stream",
    "https://frembed.pro",
    "https://embedder.net",
    "https://flixembed.net",
    "https://nunflix.org",
    "https://holamovies.org",
    "https://smashystream.xyz",
    "https://streamify.to"
)
foreach ($s in $servers) {
    try {
        $r = Invoke-WebRequest -Uri $s -UseBasicParsing -TimeoutSec 8 -MaximumRedirection 5
        Write-Host "$s --> ONLINE $($r.StatusCode)"
    } catch {
        Write-Host "$s --> FAILED"
    }
}
