const { chromium } = require('playwright');
const fs = require('fs');

async function testUiSearch() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    
    try {
        console.log("Navigating to home...");
        await page.goto('https://anichi.to/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        console.log("Typing search query...");
        await page.fill('input[name="keyword"]', 'Jujutsu Kaisen');
        await page.keyboard.press('Enter');
        
        console.log("Waiting for search results...");
        await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 });
        
        await page.waitForTimeout(3000);
        
        const html = await page.content();
        fs.writeFileSync('anichi_filter.html', html);
        console.log("Saved anichi_filter.html");
        
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await browser.close();
    }
}
testUiSearch();
