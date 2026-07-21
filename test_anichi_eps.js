const fs = require('fs');
const html = fs.readFileSync('anichi_watch.html', 'utf-8');

const epMatches = [...html.matchAll(/data-ep-id="([^"]+)"/g)];
console.log("Episodes found by data-ep-id:", epMatches.map(m => m[1]));

const linkMatches = [...html.matchAll(/data-link-id="([^"]+)"/g)];
console.log("Servers found by data-link-id:", linkMatches.map(m => m[1]));

const listMatches = [...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*title="[^"]*Episode 1[^"]*"/gi)];
console.log("Episode 1 links:", listMatches.map(m => m[1]));
