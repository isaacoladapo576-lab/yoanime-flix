const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const { buildStreamSources, isAllowedProviderUrl } = require('./stream-sources');
const { createOwnedMediaLibrary } = require('./owned-media');

const PORT = process.env.PORT || 8080;
const ownedMedia = createOwnedMediaLibrary();

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css':  'text/css',
    '.js':   'text/javascript',
    '.json': 'application/json',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
};

// ── Helper: fetch URL with cookie/header support ──────────────
function fetchUrl(url, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const isHttps = parsed.protocol === 'https:';
        const mod = isHttps ? https : http;
        mod.get({
            hostname: parsed.hostname,
            path: parsed.pathname + parsed.search,
            port: parsed.port || (isHttps ? 443 : 80),
            rejectUnauthorized: false,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/html, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'X-Requested-With': 'XMLHttpRequest',
                ...extraHeaders
            }
        }, (res) => {
            const loc = res.headers['location'];
            if ([301,302,307,308].includes(res.statusCode) && loc) {
                const newUrl = loc.startsWith('http') ? loc : new URL(loc, url).href;
                return fetchUrl(newUrl, extraHeaders).then(resolve).catch(reject);
            }
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data }));
        }).on('error', reject);
    });
}

function sendJson(res, status, body) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
}

function probeStreamEndpoint(targetUrl, redirectsLeft = 4, method = 'HEAD') {
    return new Promise((resolve) => {
        if (!isAllowedProviderUrl(targetUrl)) {
            resolve({ status: 0, ok: false, error: 'Host is not an approved stream provider' });
            return;
        }

        const parsed = new URL(targetUrl);
        const request = https.request({
            hostname: parsed.hostname,
            path: parsed.pathname + parsed.search,
            port: parsed.port || 443,
            method,
            rejectUnauthorized: false,
            timeout: 4500,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,*/*',
                ...(method === 'GET' ? { Range: 'bytes=0-1023' } : {})
            }
        }, async (response) => {
            response.resume();
            const status = response.statusCode || 0;
            const location = response.headers.location;

            if ([301, 302, 303, 307, 308].includes(status) && location && redirectsLeft > 0) {
                const nextUrl = new URL(location, targetUrl).href;
                if (!isAllowedProviderUrl(nextUrl)) {
                    resolve({ status, ok: true, redirected: true });
                    return;
                }
                resolve(await probeStreamEndpoint(nextUrl, redirectsLeft - 1, method));
                return;
            }

            // Some embed hosts do not implement HEAD and report it as a 404.
            if ([404, 405, 501].includes(status) && method === 'HEAD') {
                resolve(await probeStreamEndpoint(targetUrl, redirectsLeft, 'GET'));
                return;
            }

            // Authentication and rate-limit responses still prove that the host is online.
            resolve({ status, ok: status > 0 && status < 500 && status !== 404 });
        });

        request.on('timeout', () => request.destroy(new Error('Probe timed out')));
        request.on('error', (error) => resolve({ status: 0, ok: false, error: error.message }));
        request.end();
    });
}

// ── HiAnime Scraper ───────────────────────────────────────────
// Uses the public aniwatch/consumet community API instances
const HIANIME_APIS = [
    'https://api.aniwatchtv.to',
    'https://aniwatch.api.net',
];

async function scrapeHiAnime(title, episode, isDub) {
    // Try multiple public Consumet/Aniwatch API mirrors
    const apis = [
        `https://consumet-api-rust.vercel.app/anime/gogoanime/${encodeURIComponent(title)}`,
        `https://api.consumet.org/anime/gogoanime/${encodeURIComponent(title)}`,
        `https://consumet.vercel.app/anime/gogoanime/${encodeURIComponent(title)}`,
    ];

    for (const apiUrl of apis) {
        try {
            console.log(`[HiAnime] Trying: ${apiUrl}`);
            const r = await fetchUrl(apiUrl);
            if (r.status !== 200) continue;
            const json = JSON.parse(r.data);
            const results = json.results || json.data || [];
            if (!results.length) continue;

            // Find best match (prefer non-dub if sub requested)
            let match = results.find(r => 
                isDub ? r.id?.includes('dub') : !r.id?.includes('dub')
            ) || results[0];

            if (!match?.id) continue;

            // Get episode stream
            const epSlug = `${match.id}-episode-${episode}`;
            const streamUrl = `https://consumet-api-rust.vercel.app/anime/gogoanime/watch/${encodeURIComponent(epSlug)}`;
            console.log(`[HiAnime] Fetching stream: ${streamUrl}`);
            const sr = await fetchUrl(streamUrl);
            if (sr.status !== 200) continue;
            const streamData = JSON.parse(sr.data);

            // Find best quality source (prefer m3u8)
            const sources = streamData.sources || [];
            const m3u8 = sources.find(s => s.quality === '1080p' || s.isM3U8) || sources[0];
            if (m3u8?.url) {
                return { success: true, url: m3u8.url, type: m3u8.isM3U8 ? 'hls' : 'mp4', quality: m3u8.quality };
            }
        } catch(e) {
            console.log(`[HiAnime] Error: ${e.message}`);
        }
    }
    return null;
}

// ── HTTP SERVER ───────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
    const urlObj   = new URL(req.url, 'http://localhost');
    const pathname = urlObj.pathname;
    const method   = req.method.toUpperCase();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    if (await ownedMedia.handle(req, res, urlObj)) return;

    // Anichi scraper endpoint — with request-ID cancellation
    if (pathname === '/api/scrape/anichi') {
        const title = urlObj.searchParams.get('title');
        const ep = urlObj.searchParams.get('ep') || '1';
        const season = urlObj.searchParams.get('season') || '1';
        const isDub = urlObj.searchParams.get('isDub') === 'true';
        const reqId = urlObj.searchParams.get('reqId') || '';
        
        if (!title) {
            sendJson(res, 400, { success: false, error: 'title is required' });
            return;
        }
        
        // Track the latest request per title so we can drop stale ones
        if (!global._anichiLatestReqId) global._anichiLatestReqId = {};
        const key = title.toLowerCase();
        global._anichiLatestReqId[key] = reqId;
        const myReqId = reqId;
        
        console.log(`[Server] Received Anichi scrape request for: ${title} S${season} E${ep} (Dub: ${isDub}) [reqId=${reqId}]`);
        
        try {
            const { scrapeAnichi } = require('./anichi_scraper.js');
            scrapeAnichi(title, ep, season, isDub).then(url => {
                if (global._anichiLatestReqId[key] !== myReqId) {
                    console.log(`[Server] Dropping stale Anichi result for ${key} (Expected: ${global._anichiLatestReqId[key]}, Got: ${myReqId})`);
                    if (!res.headersSent) {
                        res.writeHead(499, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: "Stale request dropped" }));
                    }
                    return;
                }
                if (url) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ url }));
                } else {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: "Stream not found" }));
                }
            }).catch(e => {
                console.error("Anichi Scraper Error:", e.message);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end(e.message);
            });
            return;
        } catch (e) {
            console.error("Anichi Module Error:", e.message);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end(e.message);
            return;
        }
    }

    // Dulo.tv scraper endpoint
    if (pathname === '/api/scrape/dulo') {
        const id = urlObj.searchParams.get('id');
        const s = urlObj.searchParams.get('s');
        const ep = urlObj.searchParams.get('ep');
        
        if (!id) {
            sendJson(res, 400, { success: false, error: 'id is required' });
            return;
        }
        
        console.log(`[Server] Received Dulo scrape request for TMDB ${id} S${s||'N/A'} E${ep||'N/A'}`);
        
        try {
            const { scrapeDulo } = require('./dulo_scraper.js');
            scrapeDulo(id, s, ep).then(url => {
                if (url) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ url }));
                } else {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: "Stream not found" }));
                }
            }).catch(e => {
                console.error("Dulo Scraper Error:", e.message);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end(e.message);
            });
            return;
        } catch (e) {
            console.error("Dulo Module Error:", e.message);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end(e.message);
            return;
        }
    }

    // Return an ordered primary + fallback catalog for the requested title.
    // Supports both /api/streams?type=tv&id=123 and /api/streams/tv/123.
    if (pathname === '/api/streams' || pathname.startsWith('/api/streams/')) {
        const routeParts = pathname.split('/').filter(Boolean);
        const type = (routeParts[2] || urlObj.searchParams.get('type') || '').toLowerCase();
        const id = routeParts[3] || urlObj.searchParams.get('id') || '';
        const tmdbId = urlObj.searchParams.get('tmdbId') || (type !== 'anime' ? id : '');
        const anilistId = urlObj.searchParams.get('anilistId') || (type === 'anime' ? id : '');

        if (!['movie', 'tv', 'show', 'anime'].includes(type)) {
            sendJson(res, 400, { success: false, error: 'type must be movie, tv, show, or anime' });
            return;
        }

        const sources = buildStreamSources({
            type,
            tmdbId,
            anilistId,
            season: urlObj.searchParams.get('season'),
            episode: urlObj.searchParams.get('episode'),
            audio: urlObj.searchParams.get('audio')
        });

        if (!sources.length) {
            sendJson(res, 400, { success: false, error: 'A numeric TMDB or AniList id is required' });
            return;
        }

        sendJson(res, 200, {
            success: true,
            type: type === 'show' ? 'tv' : type,
            sources,
            primary: sources[0],
            fallbacks: sources.slice(1)
        });
        return;
    }
    // ── Health Check Endpoint ────────────────────────────────
    if (pathname === '/api/health') {
        const checkUrl = urlObj.searchParams.get('url');
        if (!checkUrl) {
            sendJson(res, 400, { error: 'Missing ?url=' });
            return;
        }
        const result = await probeStreamEndpoint(checkUrl);
        sendJson(res, 200, result);
        return;
    }


    // ── Vidsrc Proxy ──────────────────────────────────────────
    if (pathname.startsWith('/api/vidsrc/')) {
        const parts = pathname.split('/');
        if (parts.length >= 5) {
            const anilistId = parts[3];
            const ep = parts[4];
            const targetUrl = `https://vidsrc.pm/embed/anime/${anilistId}/${ep}`;
            
            console.log(`[Proxy] Fetching: ${targetUrl}`);
            
            https.get(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://vidsrc.pm/' } }, (vRes) => {
                let data = '';
                vRes.on('data', c => data += c);
                vRes.on('end', () => {
                    let modified = data.replace(/<script>\s*\(\s*function\s*\(\s*\)\s*\{[\s\S]*?var\s*die\s*=[\s\S]*?<\/script>/i, '<!-- ANTI-ADBLOCK REMOVED BY PROXY -->');
                    modified = modified.replace(/<head>/i, '<head><base href="https://vidsrc.pm/">');
                    
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(modified);
                });
            }).on('error', (e) => {
                res.writeHead(500);
                res.end(`Proxy Error: ${e.message}`);
            });
            return;
        }
    }

    // ── Vidsrc Proxy (TMDB) ───────────────────────────────────
    if (pathname.startsWith('/api/vidsrc/')) {
        const parts = pathname.split('/');
        if (parts.length >= 6) {
            const tmdbId = parts[3];
            const s = parts[4];
            const e = parts[5];
            const targetUrl = `https://vidsrc.pm/embed/tv/${tmdbId}/${s}/${e}`;
            
            console.log(`[Proxy] Fetching: ${targetUrl}`);
            
            https.get(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://vidsrc.pm/' } }, (vRes) => {
                let data = '';
                vRes.on('data', c => data += c);
                vRes.on('end', () => {
                    let modified = data.replace(/<script>\s*\(\s*function\s*\(\s*\)\s*\{[\s\S]*?var\s*die\s*=[\s\S]*?<\/script>/i, '<!-- ANTI-ADBLOCK REMOVED BY PROXY -->');
                    modified = modified.replace(/<head>/i, '<head><base href="https://vidsrc.pm/">');
                    
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(modified);
                });
            }).on('error', (err) => {
                res.writeHead(500);
                res.end(`Proxy Error: ${err.message}`);
            });
            return;
        }
    }

    // ── Static Files ──────────────────────────────────────────
    let staticPath = pathname === '/' ? '/index.html' : pathname;
    const filePath = path.join(__dirname, staticPath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end(`Server error: ${err.code}`);
        } else {
            const headers = { 'Content-Type': contentType };
            if (ext === '.html' || ext === '.js' || ext === '.css') {
                headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
                headers['Pragma'] = 'no-cache';
                headers['Expires'] = '0';
            }
            res.writeHead(200, headers);
            res.end(content);
        }
    });
});

if (require.main === module) server.listen(PORT, '0.0.0.0', async () => {
    console.log(`\n╔══════════════════════════════════════════════════╗`);
    console.log(`║  🎌  YoAnime.Flx  —  Scraper + Static Server     ║`);
    console.log(`╠══════════════════════════════════════════════════╣`);
    console.log(`║  Site:  http://localhost:${PORT}${' '.repeat(20 - PORT.toString().length)} ║`);
    console.log(`║  API:   /api/scrape/anichi?title=...&ep=1       ║`);
    console.log(`╚══════════════════════════════════════════════════╝\n`);

    // Setup Localtunnel for mobile access
    try {
        const localtunnel = require('localtunnel');
        const tunnel = await localtunnel({ port: PORT });
        
        console.log(`\n🚀 [PUBLIC URL] Mobile/Remote Access: ${tunnel.url}`);
        console.log(`   (Open this link on your phone. If prompted, click "Click to Continue")\n`);
        
        tunnel.on('close', () => {
            console.log('[PUBLIC URL] Tunnel closed.');
        });
    } catch (err) {
        console.log(`[PUBLIC URL] Failed to start tunnel: ${err.message}`);
    }
});

module.exports = { server, probeStreamEndpoint };
