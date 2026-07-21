const https = require('https');

async function check() {
    https.get('https://vidsrc.net/embed/tv?tmdb=113415&season=1&episode=1', { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => console.log(data.substring(0, 500)));
    });
}
check();
