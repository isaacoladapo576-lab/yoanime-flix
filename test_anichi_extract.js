const fs = require('fs');
const html = fs.readFileSync('anichi_filter.html', 'utf-8');

// The anime cards might have class 'film-name' or 'name' or 'd-title'
const matches = [...html.matchAll(/class="[^"]*title[^"]*".*?>([^<]+)</gi)];
console.log("Titles found:");
matches.forEach(m => console.log(m[1].trim()));

// Check for posters
const posterMatches = [...html.matchAll(/class="film-poster[^>]*>[\s\S]*?<a href="([^"]+)"/gi)];
console.log("Posters found:");
posterMatches.forEach(m => console.log(m[1].trim()));
