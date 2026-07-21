const http = require('http');
http.get('http://dulo.tv/show/2691', (res) => {
    console.log('X-Frame-Options:', res.headers['x-frame-options']);
    console.log('Content-Security-Policy:', res.headers['content-security-policy']);
});
