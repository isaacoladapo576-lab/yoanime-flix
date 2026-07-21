const { chromium } = require('playwright');

async function scrapeHianime() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    
    try {
        console.log("Navigating to hianime search...");
        await page.goto('https://hianime.to/search?keyword=jujutsu', { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        await page.waitForTimeout(3000);
        const title = await page.title();
        console.log("Title:", title);
        
        if (title.includes('Just a moment') || title.includes('Cloudflare')) {
            console.log("Hit Cloudflare. Can't bypass headlessly easily.");
        } else {
            const links = await page.$$eval('.film-poster a', els => els.map(e => e.getAttribute('href')));
            console.log("Links found:", links);
        }
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await browser.close();
    }
}
scrapeHianime();
