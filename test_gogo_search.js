const https = require('https');
const http = require('http');

async function fetchUrl(url, cookie = '') {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const mod = parsed.protocol === 'https:' ? https : http;
        mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': cookie } }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve({ data, headers: res.headers }));
        }).on('error', reject);
    });
}

async function run() {
    const searchUrl = 'https://gogoanime3.co/search.html?keyword=jujutsu';
    let res = await fetchUrl(searchUrl);
    
    // Follow JS redirect
    const redirectMatch = res.data.match(/window\.location\.replace\('([^']+)'\)/);
    if (redirectMatch) {
        console.log('Following JS redirect...');
        let cookies = '';
        if (res.headers['set-cookie']) {
            cookies = res.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
        }
        res = await fetchUrl(redirectMatch[1], cookies);
    }
    
    // find all links
    const matches = [...res.data.matchAll(/<a href="\/category\/([^"]+)"/ig)];
    for(const m of matches) {
        console.log(m[1]);
    }
}
run();
