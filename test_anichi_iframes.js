const fs = require('fs');
const html = fs.readFileSync('anichi_watch.html', 'utf-8');

const matches = [...html.matchAll(/<iframe[^>]*src="([^"]+)"/gi)];
console.log("Iframes found:");
matches.forEach(m => console.log(m[1]));
