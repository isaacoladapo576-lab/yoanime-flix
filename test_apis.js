const https = require('https');

function get(url, headers = {}) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json, text/html, */*',
                ...headers
            },
            timeout: 12000
        }, res => {
            // Follow redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return resolve(get(res.headers.location, headers));
            }
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(d), raw: d }); }
                catch { resolve({ status: res.statusCode, data: null, raw: d.slice(0, 500) }); }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    });
}

async function test(label, url, headers) {
    try {
        const r = await get(url, headers);
        const out = r.data ? JSON.stringify(r.data).slice(0,300) : r.raw?.slice(0,200);
        console.log(`✅ ${label} [${r.status}]:`, out);
        return r;
    } catch(e) {
        console.log(`❌ ${label}: ${e.message}`);
        return null;
    }
}

(async () => {
    // === Working public anime stream APIs ===

    // 1. Aniwatch.to (hianime) - unofficial API hosted by community
    await test('Aniwatch unofficial API - search', 'https://aniwatch-api-dusky.vercel.app/api/v2/hianime/search?q=naruto&page=1');
    
    // 2. Another aniwatch API instance
    await test('Aniwatch API 2', 'https://aniwatch-api-one.vercel.app/api/v2/hianime/search?q=naruto&page=1');
    
    // 3. AniList to stream via AniSkip/AniSearch
    await test('AniList search POST via GET-compat', 'https://graphql.anilist.co/');

    // 4. Gogoanime via public proxy
    await test('GogoAnime search', 'https://ajax.gogocdn.net/site/loadAjaxSearch?keyword=naruto&id=-1&link_web=https://gogoanime3.co/', {
        'Referer': 'https://gogoanime3.co/'
    });

    // 5. Try direct known episode link on GogoAnime CDN
    await test('GogoAnime episode list', 
        'https://ajax.gogocdn.net/ajax/load-list-episode?ep_start=1&ep_end=1&id=367&default_ep=1&alias=naruto',
        { 'Referer': 'https://gogoanime3.co/' }
    );

    // 6. Test a known gogoanime stream endpoint  
    await test('GogoAnime streaming server', 'https://embtaku.pro/streaming.php?id=MTA1NjI=&title=Naruto+Episode+1', {
        'Referer': 'https://gogoanime3.co/'
    });

    // 7. AllAnime API (used by some apps)
    await test('AllAnime API', 'https://api.allanime.day/api?variables=%7B%22search%22%3A%7B%22query%22%3A%22naruto%22%7D%2C%22limit%22%3A5%7D&extensions=%7B%22persistedQuery%22%3A%7B%22version%22%3A1%2C%22sha256Hash%22%3A%229343797cc3d9e3f444e2d3b7db9a84d759b816a4d84512ea72d079f85bb96e98%22%7D%7D');
})();
