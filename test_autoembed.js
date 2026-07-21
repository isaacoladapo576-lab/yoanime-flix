const https = require('https');
https.get('https://autoembed.co/tv/tmdb/85937-1-1', { rejectUnauthorized: false }, res => {
    let d='';
    res.on('data', c=>d+=c);
    res.on('end', ()=>console.log('Autoembed:', res.statusCode, d.substring(0, 300)));
}).on('error', console.error);
