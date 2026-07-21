const https = require('https');

// Anime providers that might support dub/sub selection via URL
const providers = [
    // TryEmbed mirrors/alternates
    { name: 'tryembed.net', url: 'https://tryembed.net/embed/anime/113415/1/dub' },
    { name: 'tryembed.pro', url: 'https://tryembed.pro/embed/anime/113415/1/dub' },
    // Aniwave/9anime style
    { name: '2anime.xyz', url: 'https://2anime.xyz/embed/113415/1/dub' },
    // Anime-specific embed providers
    { name: 'anime.autoembed', url: 'https://autoembed.co/anime/tmdb/113415-1' },
    { name: 'animesrc', url: 'https://animesrc.to/embed/anime/113415/1/dub' },
    // Anicrush
    { name: 'anicrush', url: 'https://anicrush.to/watch/113415?ep=1&type=dub' },
    // Embanime
    { name: 'embanime', url: 'https://embanime.com/embed/113415/1/dub' },
    // AnimeAPI
    { name: 'animeapi.skin', url: 'https://animeapi.skin/embed/113415/1/dub' },
    // 2embed anime route
    { name: '2embed-anime', url: 'https://www.2embed.cc/embedanime/113415/?ep=1&type=dub' },
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

setTimeout(() => { console.log('--- TIMEOUT ---'); process.exit(0); }, 12000);
