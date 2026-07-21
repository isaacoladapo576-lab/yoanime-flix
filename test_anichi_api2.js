const { chromium } = require('playwright');

async function testApi() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
        await page.goto('https://anichi.to/watch/jujutsu-kaisen-tv-8ssye?ep=1', { waitUntil: 'domcontentloaded' });
        
        await page.waitForTimeout(3000);
        
        const res = await page.evaluate(async () => {
            try {
                // Try fetching the servers list for episode 19314
                const f = await fetch('/ajax/server/list?ep=19314');
                const html = await f.text();
                return html;
            } catch (e) {
                return e.message;
            }
        });
        
        console.log("Server List Result:", res.substring(0, 500));
        
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await browser.close();
    }
}
testApi();
