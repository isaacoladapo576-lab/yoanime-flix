const https = require('https');

async function check() {
    https.get('https://vidsrc.net/embed/anime/113415/1/sub', { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => console.log(data.substring(0, 500)));
    });
}
check();
