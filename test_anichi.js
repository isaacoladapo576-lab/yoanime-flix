const fs = require('fs');
const html = fs.readFileSync('anichi_dump.html', 'utf8');

// Search for anything that looks like an embed URL, or server list in JSON
const servers = [...html.matchAll(/"server[^>]*"|https?:\/\/[^\s"'><]+embed[^\s"'><]+/ig)].map(m => m[0]);
console.log("Found embed-like strings:");
console.log(servers.slice(0, 10));

// Or look for data-id, data-server
const dataAttrs = [...html.matchAll(/data-.*?="([^"]+)"/g)].map(m => m[0]);
console.log("\nFound data attributes:");
console.log(dataAttrs.slice(0, 15));
