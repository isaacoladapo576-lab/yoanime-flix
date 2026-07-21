const https = require('https');

function check(url) {
    return new Promise((resolve) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, rejectUnauthorized: false }, (res) => {
            resolve(`[${res.statusCode}] ${url}`);
        }).on('error', e => resolve(`[ERR] ${url}: ${e.message}`));
    });
}

async function run() {
    console.log(await check('https://api-consumet-org-gamma.vercel.app/meta/anilist/info/113415'));
    console.log(await check('https://api-consumet-org-gamma.vercel.app/anime/gogoanime/info/jujutsu-kaisen'));
}
run();
