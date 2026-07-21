const fs = require('fs');
const html = fs.readFileSync('lunar_dump.html', 'utf8');

const regex = /href="(\/anime\/[a-zA-Z0-9-]+)"/g;
let match;
const links = new Set();
while ((match = regex.exec(html)) !== null) {
    links.add(match[1]);
}

console.log("Anime links:", Array.from(links).slice(0, 10));
