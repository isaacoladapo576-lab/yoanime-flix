const https = require('https');

function fetchJson(url) {
    return new Promise((resolve) => {
        https.get(url, { headers: { 'User-Agent': 'BlondyFlix/1.0 (test)' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch(e) { resolve(null); }
            });
        }).on('error', () => resolve(null));
    });
}

async function getWikiImage(title) {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(title + " film")}&utf8=&format=json`;
    const search = await fetchJson(searchUrl);
    if (!search || !search.query || !search.query.search[0]) return null;
    
    const pageId = search.query.search[0].pageid;
    const pageUrl = `https://en.wikipedia.org/w/api.php?action=query&pageids=${pageId}&prop=pageimages&pithumbsize=500&format=json`;
    const page = await fetchJson(pageUrl);
    if (page && page.query && page.query.pages[pageId] && page.query.pages[pageId].thumbnail) {
        return page.query.pages[pageId].thumbnail.source;
    }
    return null;
}

async function run() {
    console.log(await getWikiImage('Inception'));
    console.log(await getWikiImage('The Dark Knight'));
}
run();
