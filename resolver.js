/**
 * ============================================
 * CUSTOM SOURCE RESOLVER — Headless Browser Edition
 * Uses Playwright to intercept real .m3u8 / .mp4 stream
 * URLs from embed pages, bypassing obfuscated JavaScript.
 * ============================================
 */

let playwright;
try {
    playwright = require('playwright');
} catch (e) {
    playwright = null;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/**
 * Launch a stealth Chromium browser, navigate to the embed URL,
 * and intercept the first HLS (.m3u8) or MP4 (.mp4) network
 * request that the page fires.  Times out after `timeoutMs`.
 */
async function interceptStream(embedUrl, timeoutMs = 45000) {
    if (!playwright) throw new Error('Playwright not installed');

    const browser = await playwright.chromium.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-web-security',
            '--autoplay-policy=no-user-gesture-required',
            '--disable-features=IsolateOrigins,site-per-process'
        ]
    });

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 },
        extraHTTPHeaders: {
            'Accept-Language': 'en-US,en;q=0.9',
        }
    });

    const page = await context.newPage();

    // Mask automation signals
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        window.chrome = { runtime: {} };
    });

    return new Promise(async (resolve, reject) => {
        const foundStreams = [];
        let settled = false;

        const finish = async (streams, error) => {
            if (settled) return;
            settled = true;
            await browser.close().catch(() => {});
            if (error) reject(error);
            else resolve(streams);
        };

        const timer = setTimeout(() => {
            if (foundStreams.length > 0) finish(foundStreams, null);
            else finish([], new Error(`Timeout: no stream intercepted within ${timeoutMs}ms`));
        }, timeoutMs);

        // Intercept REQUESTS for m3u8 / mp4
        page.on('request', req => {
            const url = req.url();
            if (url.includes('.m3u8') || (url.includes('.mp4') && !url.includes('ads'))) {
                const type = url.includes('.m3u8') ? 'hls' : 'mp4';
                console.log(`[Resolver] ✅ Intercepted ${type.toUpperCase()}: ${url.slice(0, 100)}…`);
                foundStreams.push({ url, type, quality: 'auto' });
                clearTimeout(timer);
                finish(foundStreams, null);
            }
        });

        // Also intercept RESPONSES that contain JSON source lists
        page.on('response', async res => {
            try {
                const url = res.url();
                const ct = res.headers()['content-type'] || '';
                if (!ct.includes('json')) return;
                // Only check API-like endpoints
                if (!url.includes('source') && !url.includes('embed') && !url.includes('stream') && !url.includes('ajax')) return;
                const json = await res.json().catch(() => null);
                if (!json) return;

                // Look for m3u8 URL buried in response JSON
                const text = JSON.stringify(json);
                const m3u8 = text.match(/https?:\/\/[^"']+\.m3u8[^"']*/g);
                const mp4  = text.match(/https?:\/\/[^"']+\.mp4[^"']*/g);

                if (m3u8 || mp4) {
                    const streams = [
                        ...(m3u8 || []).map(u => ({ url: u, type: 'hls', quality: 'auto' })),
                        ...(mp4  || []).map(u => ({ url: u, type: 'mp4', quality: 'auto' }))
                    ];
                    console.log(`[Resolver] ✅ Found streams in JSON response: ${url.slice(0, 80)}`);
                    clearTimeout(timer);
                    finish(streams, null);
                }
            } catch (_) {}
        });

        try {
            await page.goto(embedUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
            
            // Wait a moment for JS to execute
            await page.waitForTimeout(3000);

            // Try clicking any play-style button
            const playSelectors = [
                'button.play', '.play-button', '.play-btn',
                '[class*="play"]', '[id*="play"]',
                'video', '.jw-icon-display', '.plyr__control--overlaid'
            ];
            for (const sel of playSelectors) {
                try {
                    const el = await page.$(sel);
                    if (el) {
                        await el.click({ timeout: 1000 });
                        console.log(`[Resolver] Clicked: ${sel}`);
                        break;
                    }
                } catch (_) {}
            }
        } catch (err) {
            finish([], err);
        }
    });
}

// ──────────────────────────────────────────────
// Base class
// ──────────────────────────────────────────────
class BaseResolver {
    constructor(name) { this.name = name; }
    async resolve(id, type, season, episode) {
        throw new Error('resolve() must be implemented');
    }
}

// ──────────────────────────────────────────────
// VidSrc.to Resolver
// ──────────────────────────────────────────────
class VidSrcToResolver extends BaseResolver {
    constructor() { super('VidSrc.to'); }

    async resolve(id, type, season, episode) {
        const embedUrl = (type === 'show' || type === 'anime')
            ? `https://vidsrc.to/embed/tv/${id}/${season}/${episode}`
            : `https://vidsrc.to/embed/movie/${id}`;

        console.log(`[VidSrc.to] Launching headless browser → ${embedUrl}`);
        const streams = await interceptStream(embedUrl, 30000);
        return { success: true, title: 'VidSrc.to Stream', sources: streams };
    }
}

// ──────────────────────────────────────────────
// MultiEmbed Resolver
// ──────────────────────────────────────────────
class MultiEmbedResolver extends BaseResolver {
    constructor() { super('MultiEmbed'); }

    async resolve(id, type, season, episode) {
        const embedUrl = (type === 'show' || type === 'anime')
            ? `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${season}&e=${episode}`
            : `https://multiembed.mov/?video_id=${id}&tmdb=1`;

        console.log(`[MultiEmbed] Launching headless browser → ${embedUrl}`);
        const streams = await interceptStream(embedUrl, 30000);
        return { success: true, title: 'MultiEmbed Stream', sources: streams };
    }
}

// ──────────────────────────────────────────────
// 2Embed Resolver
// ──────────────────────────────────────────────
class TwoEmbedResolver extends BaseResolver {
    constructor() { super('2Embed'); }

    async resolve(id, type, season, episode) {
        const embedUrl = (type === 'show' || type === 'anime')
            ? `https://www.2embed.skin/embedtv/${id}&s=${season}&e=${episode}`
            : `https://www.2embed.skin/embed/${id}`;

        console.log(`[2Embed] Launching headless browser → ${embedUrl}`);
        const streams = await interceptStream(embedUrl, 30000);
        return { success: true, title: '2Embed Stream', sources: streams };
    }
}

// ──────────────────────────────────────────────
// SuperEmbed Resolver
// ──────────────────────────────────────────────
class SuperEmbedResolver extends BaseResolver {
    constructor() { super('SuperEmbed'); }

    async resolve(id, type, season, episode) {
        const embedUrl = (type === 'show' || type === 'anime')
            ? `https://superembed.stream/embed?tmdb_id=${id}&type=tv&season=${season}&episode=${episode}`
            : `https://superembed.stream/embed?tmdb_id=${id}&type=movie`;

        console.log(`[SuperEmbed] Launching headless browser → ${embedUrl}`);
        const streams = await interceptStream(embedUrl, 30000);
        return { success: true, title: 'SuperEmbed Stream', sources: streams };
    }
}

// ──────────────────────────────────────────────
// VidSrc.me Resolver
// ──────────────────────────────────────────────
class VidSrcMeResolver extends BaseResolver {
    constructor() { super('VidSrc.me'); }

    async resolve(id, type, season, episode) {
        const embedUrl = (type === 'show' || type === 'anime')
            ? `https://vidsrc.me/embed/tv?tmdb=${id}&season=${season}&episode=${episode}`
            : `https://vidsrc.me/embed/movie?tmdb=${id}`;

        console.log(`[VidSrc.me] Launching headless browser → ${embedUrl}`);
        const streams = await interceptStream(embedUrl, 30000);
        return { success: true, title: 'VidSrc.me Stream', sources: streams };
    }
}

// ──────────────────────────────────────────────
// VidLink.pro Resolver (403 on plain HTTP, try via browser)
// ──────────────────────────────────────────────
class VidLinkResolver extends BaseResolver {
    constructor() { super('VidLink.pro'); }

    async resolve(id, type, season, episode) {
        const embedUrl = (type === 'show' || type === 'anime')
            ? `https://vidlink.pro/tv/${id}/${season}/${episode}`
            : `https://vidlink.pro/movie/${id}`;

        console.log(`[VidLink.pro] Launching headless browser → ${embedUrl}`);
        const streams = await interceptStream(embedUrl, 30000);
        return { success: true, title: 'VidLink.pro Stream', sources: streams };
    }
}

// ──────────────────────────────────────────────
// Manager
// ──────────────────────────────────────────────
class ResolverManager {
    constructor() {
        this.resolvers = {};
        // Register all resolvers in priority order
        [
            new VidSrcToResolver(),
            new MultiEmbedResolver(),
            new TwoEmbedResolver(),
            new SuperEmbedResolver(),
            new VidSrcMeResolver(),
            new VidLinkResolver()
        ].forEach(r => this.register(r));
    }

    register(resolver) {
        this.resolvers[resolver.name] = resolver;
    }

    async resolve(serverName, id, type, season, episode) {
        if (!playwright) {
            return {
                success: false,
                error: 'Playwright is not installed. Run: npm install playwright && npx playwright install chromium'
            };
        }
        const resolver = this.resolvers[serverName];
        if (!resolver) {
            return { success: false, error: `No resolver for "${serverName}"` };
        }
        try {
            return await resolver.resolve(id, type, season, episode);
        } catch (err) {
            console.error(`[Resolver] ${serverName} failed:`, err.message);
            return { success: false, error: err.message };
        }
    }
}

module.exports = new ResolverManager();
