const https = require('https');
const http = require('http');

async function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const mod = parsed.protocol === 'https:' ? https : http;
        mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function scrapeGogo(title, ep, isDub) {
    try {
        // 1. Search
        const query = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const searchUrl = `https://gogoanime3.co/search.html?keyword=${encodeURIComponent(title)}`;
        console.log('Searching:', searchUrl);
        let html = await fetchUrl(searchUrl);
        
        // Very basic parsing for the first result
        let match = html.match(/<p class="name"><a href="\/category\/([^"]+)"/i);
        if (!match) {
            console.log('No results found for:', title);
            return;
        }
        
        let slug = match[1];
        if (isDub) {
            // Check if dub version exists in search results
            const dubMatch = html.match(new RegExp(`<p class="name"><a href="\\/category\\/([^"]+-dub)"`, 'i'));
            if (dubMatch) slug = dubMatch[1];
            else slug += '-dub';
        }
        
        console.log('Found slug:', slug);
        
        // 2. Get Episode Page
        const epUrl = `https://gogoanime3.co/${slug}-episode-${ep}`;
        console.log('Fetching Episode:', epUrl);
        html = await fetchUrl(epUrl);
        
        // Extract embed link
        match = html.match(/<iframe src="([^"]+)"/i);
        if (!match) {
            console.log('No iframe found on episode page');
            return;
        }
        
        let embedUrl = match[1];
        if (embedUrl.startsWith('//')) embedUrl = 'https:' + embedUrl;
        console.log('Embed URL:', embedUrl);
        
        // 3. We could just return the embedUrl as the iframe!
        // The embed URL is usually gogoplay or vidstreaming.
        
    } catch(e) {
        console.error(e);
    }
}

scrapeGogo('Jujutsu Kaisen', 1, true);
