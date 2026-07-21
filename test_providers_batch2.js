const https = require('https');

const providers = [
    { name: 'vidsrc.xyz', url: 'https://vidsrc.xyz/embed/tv/85937/1/1' },
    { name: 'vidsrc.in', url: 'https://vidsrc.in/embed/tv/85937/1/1' },
    { name: 'vidplay.online', url: 'https://vidplay.online/e/85937/1/1' },
    { name: 'player.smashy', url: 'https://player.smashy.stream/tv/85937?s=1&e=1' },
    { name: 'vidlink.pro', url: 'https://vidlink.pro/tv/85937/1/1' },
    { name: 'superembed', url: 'https://multiembed.mov/directstream.php?video_id=85937&tmdb=1&s=1&e=1' },
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
