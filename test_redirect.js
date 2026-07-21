const https = require('https');

function fetchUrl(url, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
        if (maxRedirects < 0) return resolve("Max redirects reached");
        
        const parsed = new URL(url);
        https.get({
            hostname: parsed.hostname,
            path: parsed.pathname + parsed.search,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        }, (res) => {
            if ([301, 302, 307, 308].includes(res.statusCode)) {
                let loc = res.headers['location'];
                if (!loc.startsWith('http')) loc = new URL(loc, url).href;
                console.log(`Redirecting to: ${loc}`);
                return fetchUrl(loc, maxRedirects - 1).then(resolve);
            }
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(`[${res.statusCode}] ${url}\n${data.substring(0, 300)}`));
        }).on('error', e => resolve(`[ERROR] ${url}: ${e.message}`));
    });
}

async function run() {
    console.log(await fetchUrl('https://api.consumet.org/anime/gogoanime/jujutsu-kaisen-tv'));
}
run();
