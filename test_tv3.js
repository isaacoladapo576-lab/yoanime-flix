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
    console.log(await check('https://cinevaro.app/embed/tv/113415/1/1'));
    console.log(await check('https://vidlink.pro/tv/113415/1/1'));
    console.log(await check('https://multiembed.mov/?video_id=113415&tmdb=1&s=1&e=1'));
    console.log(await check('https://gogoanime.me.uk/newplayer.php?id=jujutsu-kaisen-tv-episode-1'));
}
run();
