process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const https = require('https');

function headUrl(url) {
    return new Promise((resolve) => {
        try {
            const parsed = new URL(url);
            const req = https.request({
                hostname: parsed.hostname,
                path: parsed.pathname + parsed.search,
                method: 'HEAD',
                rejectUnauthorized: false,
                timeout: 5000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            }, (res) => resolve({ status: res.statusCode }));
            req.on('error', (e) => resolve({ status: 0, error: e.message }));
            req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
            req.end();
        } catch(e) { resolve({ status: 0, error: e.message }); }
    });
}

async function main() {
    console.log('=== Testing Alternative Embed APIs ===');
    const urls = [
        'https://vidlink.pro/movie/299534',
        'https://vidsrc.in/embed/movie/299534',
        'https://embed.smashystream.com/playere.php?tmdb=299534',
        'https://frembed.xyz/api/film.php?id=299534',
        'https://2embed.cc/embed/299534',
        'https://vidsrc.net/embed/movie?tmdb=299534',
        'https://vidsrc.xyz/embed/movie/299534',
        'https://moviesapi.club/movie/299534',
        'https://vidbinge.dev/embed/movie/299534',
        'https://sudo-flix.lol/embed/movie/299534'
    ];

    for (const url of urls) {
        const r = await headUrl(url);
        const emoji = r.status >= 200 && r.status < 400 ? '✅' : '❌';
        console.log(`${emoji} ${r.status || r.error} | ${url}`);
    }
}

main().catch(console.error);
