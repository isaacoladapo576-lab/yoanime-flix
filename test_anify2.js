const https = require('https');

function fetchAnify(url) {
    https.get(url, { rejectUnauthorized: false, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if ([301,302,307,308].includes(res.statusCode)) {
            console.log('Redirecting to:', res.headers.location);
            return fetchAnify(res.headers.location);
        }
        let d = '';
        res.on('data', c=>d+=c);
        res.on('end', () => console.log(res.statusCode, d.substring(0, 500)));
    }).on('error', console.error);
}
fetchAnify('https://api.anify.tv/info/113415');
