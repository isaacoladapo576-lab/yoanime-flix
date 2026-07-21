const https = require('https');

const urls = [
    "https://vidlink.pro/movie/155",
    "https://vidsrc.net/embed/movie?tmdb=155",
    "https://vidsrc.in/embed/movie?tmdb=155",
    "https://vidsrc.pm/embed/movie?tmdb=155",
    "https://player.autoembed.cc/embed/movie/155",
    "https://embed.smashystream.com/playere.php?tmdb=155",
    "https://multiembed.mov/?video_id=155&tmdb=1",
    "https://www.2embed.cc/embed/155",
    "https://moviesapi.club/movie/155",
    "https://vidsrc.me/embed/movie?tmdb=155",
    "https://vidsrc.cc/v2/embed/movie/155",
    "https://embed.su/embed/movie/155",
    "https://vidsrc.vip/embed/movie/155"
];

async function checkUrl(url) {
    return new Promise((resolve) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (data.includes('cfl.re/tos')) {
                    resolve(`BANNED: ${url}`);
                } else {
                    resolve(`OK: ${url} (Status: ${res.statusCode})`);
                }
            });
        }).on('error', (err) => resolve(`ERROR: ${url} - ${err.message}`));
    });
}

async function run() {
    for (let u of urls) {
        console.log(await checkUrl(u));
    }
}
run();
