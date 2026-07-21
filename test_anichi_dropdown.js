const { chromium } = require('playwright');
const fs = require('fs');

async function testDropdown() {
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
        
        console.log("Waiting for dropdown suggestions...");
        await page.waitForTimeout(3000); // Wait 3 seconds for AJAX
        
        const html = await page.content();
        fs.writeFileSync('anichi_dropdown.html', html);
        console.log("Saved anichi_dropdown.html");
        
        const links = await page.$$eval('.nav-result .film-poster a, .search-suggest a', els => els.map(e => e.getAttribute('href')));
        console.log("Found links in dropdown:", links);
        
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await browser.close();
    }
}
testDropdown();
