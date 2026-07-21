const https = require('https');

function check(url) {
    return new Promise((resolve) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, rejectUnauthorized: false }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(`[${res.statusCode}] ${url}\n${data.substring(0, 300)}`));
        }).on('error', e => resolve(`[ERR] ${url}: ${e.message}`));
    });
}

async function run() {
    console.log(await check('https://aniwatch-api-net.vercel.app/'));
    console.log(await check('https://aniwatch-api-net.vercel.app/anime/search?q=jujutsu'));
}
run();
