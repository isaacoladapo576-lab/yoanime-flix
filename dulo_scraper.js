const { chromium } = require('playwright');

/**
 * Scrapes a stream URL (m3u8/mp4) from dulo.tv for a given TMDB ID.
 * @param {string} tmdbId - The TMDB ID of the movie or show.
 * @param {string} season - The season number (optional, for shows).
 * @param {string} episode - The episode number (optional, for shows).
 * @returns {Promise<string|null>} The intercepted stream URL or null.
 */
async function scrapeDulo(tmdbId, season = null, episode = null) {
    const isShow = !!(season && episode);
    const url = isShow 
        ? `https://dulo.tv/show/${tmdbId}-${season}-${episode}`
        : `https://dulo.tv/movie/${tmdbId}`;

    console.log(`[Dulo] Scraping: ${url}`);
    
    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        
        let streamUrl = null;
        
        // Intercept requests to find the video stream
        page.on('request', req => {
            const reqUrl = req.url();
            if ((reqUrl.includes('.m3u8') || reqUrl.includes('.mp4')) && !reqUrl.includes('trailer')) {
                console.log(`[Dulo] Intercepted stream: ${reqUrl}`);
                streamUrl = reqUrl;
            }
        });
        
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(5000); // let SPA render
        
        // Wait for the "Tap to play" or standard play button
        const playSelectors = [
            'button[aria-label="Tap to start playback"]',
            '.lucide-play',
            'button[aria-label*="play" i]'
        ];
        
        let playBtn = null;
        for (const sel of playSelectors) {
            playBtn = await page.$(sel);
            if (playBtn) break;
        }
        
        if (playBtn) {
            console.log(`[Dulo] Found play button, clicking...`);
            await playBtn.click();
            
            // Wait up to 15 seconds for a stream to be intercepted
            let waitTime = 0;
            while (!streamUrl && waitTime < 15000) {
                await page.waitForTimeout(500);
                waitTime += 500;
            }
        } else {
            console.log(`[Dulo] No play button found, waiting to see if it autoplays...`);
            let waitTime = 0;
            while (!streamUrl && waitTime < 10000) {
                await page.waitForTimeout(500);
                waitTime += 500;
            }
        }
        
        await browser.close();
        return streamUrl;
    } catch (e) {
        console.error(`[Dulo] Scraper error:`, e.message);
        if (browser) await browser.close();
        return null;
    }
}

module.exports = { scrapeDulo };
