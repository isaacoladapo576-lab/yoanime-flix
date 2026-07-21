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
    const tmdb = '550'; // Fight Club
    const urls = [
        `https://dulo.tv/embed/movie/${tmdb}`,
        `https://dulo.tv/movie/${tmdb}`,
        `https://cinevaro.app/embed/movie/${tmdb}`,
        `https://cinevaro.app/movie/${tmdb}`,
        `https://www.cineby.at/embed/movie/${tmdb}`,
        `https://www.cineby.at/movie/${tmdb}`,
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
