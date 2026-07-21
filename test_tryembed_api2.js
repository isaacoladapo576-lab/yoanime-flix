const https = require('https');

function fetchHtml(url) {
    return new Promise((resolve) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            let cookies = res.headers['set-cookie'] || [];
            res.on('data', c => data += c);
            res.on('end', () => resolve({ html: data, cookies: cookies.map(c => c.split(';')[0]).join('; ') }));
        }).on('error', e => resolve({ html: '', cookies: '' }));
    });
}

function fetchApi(url, nonce, cookies, referer) {
    return new Promise((resolve) => {
        https.get(url, { headers: { 
            'User-Agent': 'Mozilla/5.0', 
            'X-Embed-Nonce': nonce,
            'Cookie': cookies,
            'Referer': referer
        } }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(data));
        }).on('error', e => resolve(''));
    });
}

async function run() {
    const url = 'https://tryembed.us.cc/embed/anime/113415/1/sub';
    const { html, cookies } = await fetchHtml(url);
    const nonceMatch = html.match(/window\.EMBED_NONCE=["']([^"']+)["']/);
    if (!nonceMatch) return console.log("No nonce");
    
    const apiUrl = `https://tryembed.us.cc/api/stream_data?id=113415&episode=1&audio=sub&nonce=${nonceMatch[1]}`;
    const apiRes = await fetchApi(apiUrl, nonceMatch[1], cookies, url);
    console.log("API Response:", apiRes.substring(0, 500));
}
run();
