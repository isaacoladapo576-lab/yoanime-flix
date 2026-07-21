const https = require('https');

function check(url) {
    return new Promise((resolve) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, rejectUnauthorized: false }, (res) => {
            resolve(`[${res.statusCode}] ${url}`);
        }).on('error', e => resolve(`[ERR] ${url}: ${e.message}`));
    });
}

async function run() {
    console.log(await check('https://autoembed.to/anime/anilist/113415/1/dub'));
    console.log(await check('https://vidbinge.com/embed/anime/anilist/113415/1?dub=1'));
}
run();
