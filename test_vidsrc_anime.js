const https = require('https');

function check(url) {
    return new Promise((resolve) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, rejectUnauthorized: false }, (res) => {
            resolve(`[${res.statusCode}] ${url}`);
        }).on('error', e => resolve(`[ERR] ${url}: ${e.message}`));
    });
}

async function run() {
    console.log(await check('https://vidsrc.vip/embed/anime/113415/1'));
    console.log(await check('https://vidsrc.pm/embed/anime/113415/1'));
    console.log(await check('https://vidsrc.cc/v2/embed/anime/113415/1'));
    console.log(await check('https://vidsrc.cc/v3/embed/anime/113415/1'));
}
run();
