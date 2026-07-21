const https = require('https');

const providers = [
    { name: 'multiembed', url: 'https://multiembed.mov/?video_id=85937&tmdb=1&s=1&e=1' },
    { name: 'smashystream', url: 'https://embed.smashystream.com/playere.php?tmdb=85937&s=1&e=1' },
    { name: 'moviesapi', url: 'https://moviesapi.club/tv/85937-1-1' },
    { name: 'vidsrc.me', url: 'https://vidsrc.me/embed/tv?tmdb=85937&season=1&episode=1' },
    { name: 'embedsu', url: 'https://embed.su/embed/tv/85937/1/1' },
    { name: 'nontongo', url: 'https://www.nontongo.win/embed/tv/85937/1/1' },
];

let done = 0;
for (const p of providers) {
    const parsed = new URL(p.url);
    https.get({ hostname: parsed.hostname, path: parsed.pathname + parsed.search, rejectUnauthorized: false, timeout: 5000, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
            const hasPlayer = d.includes('player') || d.includes('iframe') || d.includes('video') || d.includes('jwplayer');
            const is404 = d.includes('404') || d.includes('Not Found');
            console.log(`${p.name}: ${res.statusCode} | size=${d.length} | hasPlayer=${hasPlayer} | is404=${is404}`);
            if (++done === providers.length) process.exit(0);
        });
    }).on('error', e => {
        console.log(`${p.name}: ERROR ${e.message}`);
        if (++done === providers.length) process.exit(0);
    }).on('timeout', function() { this.destroy(); });
}
