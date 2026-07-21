const https = require('https');
https.get('https://autoembed.co/anime/anilist/113415-1', res => {
    let d=''; res.on('data', c=>d+=c); res.on('end', ()=>console.log('Status:', res.statusCode, d.substring(0, 500)));
});
