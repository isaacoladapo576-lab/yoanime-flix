const { chromium } = require('playwright');
const fs = require('fs');

async function testWatch() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    
    try {
        console.log("Navigating to watch page...");
        await page.goto('https://anichi.to/watch/jujutsu-kaisen-tv-8ssye?ep=1', { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        await page.waitForTimeout(5000);
        
        const html = await page.content();
        fs.writeFileSync('anichi_watch.html', html);
        console.log("Saved anichi_watch.html. Title:", await page.title());
        
        const iframe = await page.$eval('iframe#iframe-embed, iframe.iframe-embed, iframe', el => el.getAttribute('src')).catch(() => 'no iframe');
        console.log("Iframe:", iframe);
        
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await browser.close();
    }
}
testWatch();
