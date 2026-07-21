const { chromium } = require('playwright');
const fs = require('fs');

async function testClick() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    
    try {
        console.log("Navigating to watch page...");
        await page.goto('https://anichi.to/watch/jujutsu-kaisen-tv-8ssye?ep=1', { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        console.log("Waiting for servers to load...");
        await page.waitForSelector('.servers .server-item, li[data-link-id]', { timeout: 15000 });
        
        // Find a dub server if possible, or any server
        // Usually servers have text like "Vidstreaming", "Megacloud" and are grouped in "sub" or "dub" blocks.
        // Let's just click the first one.
        console.log("Clicking first server...");
        await page.click('li[data-link-id]');
        
        console.log("Waiting for iframe...");
        // Wait for iframe src to NOT be the recaptcha one, or just wait 3 seconds
        await page.waitForTimeout(4000);
        
        const iframes = await page.$$eval('iframe', els => els.map(e => e.getAttribute('src')));
        console.log("Iframes after click:");
        iframes.forEach(src => console.log(src));
        
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await browser.close();
    }
}
testClick();
