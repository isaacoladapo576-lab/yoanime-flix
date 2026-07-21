const https = require('https');
https.get('https://player.vidbinge.com/embed/anime/113415/1', res=>{
    let d='';
    res.on('data', c=>d+=c);
    res.on('end', ()=>console.log(d.substring(0, 300)));
});
