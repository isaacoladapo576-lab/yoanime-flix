const https = require('https');

function check(url) {
    return new Promise((resolve) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'http://localhost/' } }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(`[${res.statusCode}] ${url}\n${data.substring(0, 150)}`));
        }).on('error', e => resolve(`[ERR] ${url}: ${e.message}`));
    });
}

async function run() {
    console.log(await check('https://embed.su/embed/tv/113415/1/1'));
    console.log(await check('https://vidsrc.net/embed/tv?tmdb=113415&season=1&episode=1'));
}
run();
