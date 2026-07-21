const https = require('https');

function getM3U8() {
    return new Promise((resolve) => {
        https.get('https://tryembed.us.cc/embed/anime/113415/1/sub', { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                // Try to find the m3u8 source URL using regex
                const match = data.match(/file:\s*["']([^"']+\.m3u8[^"']*)["']/i);
                if (match && match[1]) {
                    resolve("FOUND STREAM: " + match[1]);
                } else {
                    const match2 = data.match(/source:\s*["']([^"']+)["']/i);
                    resolve("NOT FOUND. HTML sample:\n" + data.substring(0, 500));
                }
            });
        }).on('error', e => resolve(`[ERR]: ${e.message}`));
    });
}

async function run() {
    console.log(await getM3U8());
}
run();
