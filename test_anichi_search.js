const { chromium } = require('playwright');
const fs = require('fs');

async function testSearch() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    
    try {
        console.log("Navigating to search...");
        await page.goto('https://anichi.to/search?keyword=jujutsu+kaisen', { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        console.log("Waiting for results...");
        await page.waitForTimeout(3000);
        
        const html = await page.content();
        fs.writeFileSync('anichi_search.html', html);
        console.log("Saved anichi_search.html");
        
        // Find links
        const links = await page.$$eval('.film-poster a', els => els.map(e => e.getAttribute('href')));
        console.log("Found links:", links);
        
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await browser.close();
    }
}
testSearch();
