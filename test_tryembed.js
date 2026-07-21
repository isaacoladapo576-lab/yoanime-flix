const https = require('https');
https.get('https://tryembed.to/embed/anime/113415/1/sub', { rejectUnauthorized: false }, res => {
    let d='';
    res.on('data', c=>d+=c);
    res.on('end', ()=>console.log('TryEmbed:', res.statusCode, d.substring(0, 300)));
}).on('error', console.error);
