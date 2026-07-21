const https = require('https');

function check(url) {
    return new Promise((resolve) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(`[${res.statusCode}] ${url}\n${data.substring(0, 300)}`));
        }).on('error', e => resolve(`[ERR] ${url}: ${e.message}`));
    });
}

async function run() {
    console.log(await check('https://vidsrc.me/embed/tv?tmdb=113415&season=1&episode=1'));
    console.log(await check('https://vidsrc.pro/embed/tv?tmdb=113415&season=1&episode=1'));
    console.log(await check('https://2embed.cc/embed/tv/113415&s=1&e=1'));
}
run();
