process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const https = require('https');

const urls = [
    'https://tryembed.us.cc/embed/anime/113415/1/sub',
    'https://tryembed.us.cc/embed/anime/113415/1/dub',
    'https://vidsrc.rip/embed/anime/113415/1/sub',
    'https://vidsrc.rip/embed/anime/113415/1/dub',
    'https://vidsrc.pm/embed/anime/113415/1',
    'https://embed.smashystream.com/playere.php?tmdb=95479', // JJK TMDB is 95479
    'https://multiembed.mov/?video_id=95479&tmdb=1'
];

async function checkUrl(url) {
    return new Promise((resolve) => {
        const parsed = new URL(url);
        https.get({
            hostname: parsed.hostname,
            path: parsed.pathname + parsed.search,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                const xFrame = res.headers['x-frame-options'] || 'NONE';
                const csp = res.headers['content-security-policy'] || 'NONE';
                resolve(`[${res.statusCode}] ${url} | X-Frame: ${xFrame}`);
            });
        }).on('error', (err) => resolve(`[ERROR] ${url} : ${err.message}`));
    });
}

async function run() {
    for (const url of urls) {
        console.log(await checkUrl(url));
    }
}
run();
