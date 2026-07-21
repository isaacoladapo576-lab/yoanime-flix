process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const https = require('https');

function fetchStatus(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            resolve({ url, status: res.statusCode, headers: res.headers });
        }).on('error', reject);
    });
}

async function run() {
    const tmdb = '1399'; // Game of Thrones
    const s = '1';
    const e = '1';
    const urls = [
        `https://dulo.tv/embed/tv/${tmdb}/${s}/${e}`,
        `https://cinevaro.app/embed/tv/${tmdb}/${s}/${e}`,
    ];
    for (const u of urls) {
        try {
            const r = await fetchStatus(u);
            console.log(`[${r.status}] ${u} (X-Frame-Options: ${r.headers['x-frame-options'] || 'NONE'})`);
        } catch (e) {
            console.log(`[ERROR] ${u} : ${e.message}`);
        }
    }
}
run();
