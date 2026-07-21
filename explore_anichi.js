const { chromium } = require('playwright');
const fs = require('fs');

async function explore() {
    console.log("Launching browser...");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    
    console.log("Navigating to anichi.to...");
    try {
        await page.goto('https://anichi.to/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        // Wait a bit for potential Cloudflare challenge
        await page.waitForTimeout(5000);
        
        const title = await page.title();
        console.log("Page Title:", title);
        
        await page.screenshot({ path: 'anichi_home.png', fullPage: true });
        console.log("Screenshot saved to anichi_home.png");
        
        const html = await page.content();
        fs.writeFileSync('anichi_home.html', html);
        console.log("HTML saved to anichi_home.html");
        
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await browser.close();
    }
}
explore();
