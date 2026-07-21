const https = require('https');

function fetchFollow(url) {
    return new Promise((resolve) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400) {
                resolve(fetchFollow(res.headers.location));
            } else {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => resolve(`[${res.statusCode}] ${url}\n${data.substring(0, 300)}`));
            }
        }).on('error', e => resolve(`[ERR] ${url}: ${e.message}`));
    });
}

async function run() {
    console.log(await fetchFollow('https://multiembed.mov/?video_id=113415&tmdb=1&s=1&e=1'));
}
run();
