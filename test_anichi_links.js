const fs = require('fs');
const html = fs.readFileSync('anichi_filter.html', 'utf-8');

const regex = /<a[^>]+href="([^"]+)"[^>]*>[^<]*Jujutsu Kaisen[^<]*<\/a>/gi;
const matches = [...html.matchAll(regex)];
console.log(matches.map(m => m[1]));

const altRegex = /href="([^"]+)"[^>]*title="[^"]*Jujutsu Kaisen[^"]*"/gi;
const altMatches = [...html.matchAll(altRegex)];
console.log(altMatches.map(m => m[1]));
