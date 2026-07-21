const { chromium } = require('playwright');
const fs = require('fs');

async function testUrl() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    
    try {
        console.log("Navigating directly to anime page...");
        await page.goto('https://anichi.to/jujutsu-kaisen-323', { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        await page.waitForTimeout(3000);
        
        const html = await page.content();
        fs.writeFileSync('anichi_direct.html', html);
        console.log("Saved anichi_direct.html. Title:", await page.title());
        
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await browser.close();
    }
}
testUrl();
