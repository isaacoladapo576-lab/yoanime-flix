const https = require('https');
const fs = require('fs');

https.get('https://vidsrc.pm/embed/anime/113415/1', { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://vidsrc.pm/' } }, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        // Remove the anti-embed script block
        // It starts with <script>\n(function(){\n    if(window===window.top)return;
        const modified = data.replace(/<script>\s*\(\s*function\s*\(\s*\)\s*\{[\s\S]*?var\s*die\s*=[\s\S]*?<\/script>/i, '<!-- ANTI-ADBLOCK REMOVED BY PROXY -->');
        fs.writeFileSync('vidsrc_proxy_test.html', modified);
        console.log("Saved to vidsrc_proxy_test.html");
    });
}).on('error', e => console.log(e.message));
