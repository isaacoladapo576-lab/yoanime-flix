const https = require('https');

function fetchHtml(url) {
    return new Promise((resolve) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(data));
        }).on('error', e => resolve(''));
    });
}

function fetchApi(url, nonce) {
    return new Promise((resolve) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'X-Embed-Nonce': nonce } }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(data));
        }).on('error', e => resolve(''));
    });
}

async function run() {
    console.log("Fetching HTML...");
    const html = await fetchHtml('https://tryembed.us.cc/embed/anime/113415/1/sub');
    const nonceMatch = html.match(/window\.EMBED_NONCE=["']([^"']+)["']/);
    if (!nonceMatch) {
        console.log("No nonce found");
        return;
    }
    const nonce = nonceMatch[1];
    console.log("Found nonce:", nonce);
    
    console.log("Fetching API...");
    const apiUrl = `https://tryembed.us.cc/api/stream_data?id=113415&episode=1&audio=sub&nonce=${nonce}`;
    const apiRes = await fetchApi(apiUrl, nonce);
    console.log("API Response:", apiRes.substring(0, 500));
}
run();
