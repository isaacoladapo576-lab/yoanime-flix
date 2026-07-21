process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const https = require('https');
const fs = require('fs');

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        }).on('error', reject);
    });
}

async function run() {
    try {
        const res = await fetchUrl('https://anisnatch.to/home');
        fs.writeFileSync('anisnatch_dump.html', res.data);
        console.log("Saved to anisnatch_dump.html");
    } catch(e) { console.error(e); }
}
run();
