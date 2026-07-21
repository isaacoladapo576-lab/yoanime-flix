const https = require('https');

function fetchHtml(url) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        https.get({
            hostname: parsed.hostname,
            path: parsed.pathname + parsed.search,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        }).on('error', reject);
    });
}

async function scrapeGogo(title, ep, isDub) {
    const slugBase = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    // Try standard slug first
    const slugs = isDub ? [
        `${slugBase}-dub`,
        `${slugBase}-tv-dub`,
        `${slugBase}-2nd-season-dub`
    ] : [
        slugBase,
        `${slugBase}-tv`,
        `${slugBase}-2nd-season`
    ];

    for (const slug of slugs) {
        const url = `https://anitaku.to/${slug}-episode-${ep}`;
        console.log("Trying:", url);
        const res = await fetchHtml(url);
        if (res.status === 200) {
            const match = res.data.match(/<iframe[^>]+src="([^"]+)"/i);
            if (match) {
                let embed = match[1];
                if (embed.startsWith('//')) embed = 'https:' + embed;
                console.log("FOUND EMBED:", embed);
                return embed;
            }
        }
    }
    console.log("Failed to find embed.");
}

async function run() {
    await scrapeGogo('Jujutsu Kaisen', 1, false);
    await scrapeGogo('Jujutsu Kaisen', 1, true);
}
run();
