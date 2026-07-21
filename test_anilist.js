const https = require('https');

async function check() {
    const query = `
        query {
            Media(search: "Jujutsu Kaisen", type: ANIME) { id }
        }
    `;
    const res = await new Promise((resolve) => {
        const req = https.request('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, (r) => {
            let data = '';
            r.on('data', c => data += c);
            r.on('end', () => resolve(JSON.parse(data)));
        });
        req.write(JSON.stringify({ query }));
        req.end();
    });
    console.log("Anilist ID:", res.data.Media.id);
}
check();
