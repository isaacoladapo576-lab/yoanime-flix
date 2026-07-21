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
    console.log(await check('https://player.vidplus.to/embed/anime/113415/1?dub=false'));
    console.log(await check('https://vidnest.fun/embed/anime/113415/1'));
    console.log(await check('https://player.vidbinge.com/embed/anime/113415/1'));
}
run();
