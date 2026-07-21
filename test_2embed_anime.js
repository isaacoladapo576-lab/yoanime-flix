const https = require('https');
https.get('https://www.2embed.cc/embed/anime/113415/1', { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => console.log(`[${res.statusCode}] ` + data.substring(0, 100)));
}).on('error', e => console.log(e.message));
