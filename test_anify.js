const https = require('https');
https.get('https://api.anify.tv/info/113415', res => {
    let d='';
    res.on('data', c=>d+=c);
    res.on('end', ()=>console.log('Anify:', res.statusCode, d.substring(0, 300)));
}).on('error', console.error);
