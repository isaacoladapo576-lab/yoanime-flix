const https = require('https');
https.get('https://vidbinge.com/embed/tv/85937/1/1', { rejectUnauthorized: false }, res => {
    let d='';
    res.on('data', c=>d+=c);
    res.on('end', ()=>console.log('Vidbinge:', res.statusCode, d.substring(0, 300)));
}).on('error', console.error);
