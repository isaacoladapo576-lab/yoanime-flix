const https = require('https');

const providers = [
    { name: 'vidlink-anime1', url: 'https://vidlink.pro/anime/113415/1?lang=dub' },
    { name: 'vidlink-anime2', url: 'https://vidlink.pro/anime/113415/1' },
    { name: '2embed-anime', url: 'https://2embed.cc/embed/anime/113415/1' },
    { name: '2embed-anime-tmdb', url: 'https://2embed.cc/embed/anime/tmdb/85937/1/1' },
    { name: 'smashy-anime', url: 'https://player.smashy.stream/anime?anilist=113415&e=1' },
    { name: 'smashy-anime2', url: 'https://embed.smashystream.com/playere.php?anilist=113415&e=1' }
];

let done = 0;
for (const p of providers) {
    try {
        const parsed = new URL(p.url);
        https.get({ hostname: parsed.hostname, path: parsed.pathname + parsed.search, rejectUnauthorized: false, timeout: 5000, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => {
                const hasPlayer = d.includes('player') || d.includes('iframe') || d.includes('video') || d.includes('plyr') || d.includes('jwplayer');
                console.log(`✓ ${p.name}: ${res.statusCode} | size=${d.length} | hasPlayer=${hasPlayer}`);
                if (++done === providers.length) process.exit(0);
            });
        }).on('error', e => {
            console.log(`✗ ${p.name}: ${e.code || e.message}`);
            if (++done === providers.length) process.exit(0);
        }).on('timeout', function() { this.destroy(); });
    } catch(e) {
        console.log(`✗ ${p.name}: INVALID URL`);
        if (++done === providers.length) process.exit(0);
    }
}
