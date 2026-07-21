const https = require('https');

function fetchJson(url) {
    return new Promise((resolve) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve({ status: res.statusCode, data: data.substring(0, 500) }));
        }).on('error', e => resolve({ status: 500, data: e.message }));
    });
}

async function run() {
    const urls = [
        'https://aniwatch-api-net.vercel.app/api/v2/hianime/search?q=jujutsu',
        'https://api-consumet-org-gamma.vercel.app/anime/zoro/jujutsu',
        'https://api-consumet-org-gamma.vercel.app/meta/anilist/info/113415',
        'https://api.amvstr.me/api/v2/search?q=jujutsu'
    ];
    for(let u of urls) {
        const res = await fetchJson(u);
        console.log(`[${res.status}] ${u}\n${res.data}\n`);
    }
}
run();
