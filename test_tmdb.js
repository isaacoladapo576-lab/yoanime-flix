const https = require('https');

async function check() {
    const res = await new Promise((resolve) => {
        https.get('https://api.themoviedb.org/3/search/tv?api_key=94fc54848d56b0dcc8996b797fc71dbd&query=Jujutsu+Kaisen', (r) => {
            let data = '';
            r.on('data', c => data += c);
            r.on('end', () => resolve(JSON.parse(data)));
        });
    });
    console.log("TMDB ID:", res.results[0].id);
}
check();
