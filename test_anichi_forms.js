const fs = require('fs');
const html = fs.readFileSync('anichi_dropdown.html', 'utf-8');
const matches = html.match(/<form[^>]*>[\s\S]*?<\/form>/gi);
if (matches) {
    matches.forEach((m, i) => {
        console.log(`Form ${i}:`);
        console.log(m.substring(0, 200) + '...');
    });
} else {
    console.log("No forms found");
}
