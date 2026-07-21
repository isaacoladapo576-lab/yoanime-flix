const { chromium } = require('playwright');

async function scrapeAnisnatch() {
    console.log("Launching playwright...");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    console.log("Navigating to anisnatch.to...");
    try {
        await page.goto('https://anisnatch.to/home', { timeout: 15000 });
        const title = await page.title();
        console.log("Title:", title);
        const html = await page.content();
        console.log("HTML Sample:", html.substring(0, 300));
        
        // Try searching
        await page.goto('https://anisnatch.to/search?keyword=jujutsu+kaisen', { timeout: 15000 });
        const searchHtml = await page.content();
        const matches = searchHtml.match(/href=["'](\/[^"']+)["']/g) || [];
        console.log("Found links:", matches.slice(0, 10));
    } catch(e) {
        console.log("Error:", e.message);
    } finally {
        await browser.close();
    }
}
scrapeAnisnatch();
