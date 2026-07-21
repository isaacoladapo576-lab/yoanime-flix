const { chromium } = require('playwright');

async function testClick() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
        console.log("Navigating...");
        await page.goto('https://anichi.to/watch/jujutsu-kaisen-tv-8ssye?ep=1', { waitUntil: 'domcontentloaded' });
        
        await page.waitForTimeout(5000);
        
        console.log("Evaluating...");
        const result = await page.evaluate(async () => {
            const servers = document.querySelectorAll('.servers .item, li[data-link-id]');
            let clicked = false;
            for (let s of servers) {
                // If it's a dub server, or just click the first one if we can't find dub
                s.click();
                clicked = true;
                break;
            }
            if (!clicked) return { error: "No servers found" };
            
            // Wait for iframe to appear
            return new Promise(resolve => {
                setTimeout(() => {
                    const iframes = document.querySelectorAll('iframe');
                    for (let ifr of iframes) {
                        if (!ifr.src.includes('recaptcha')) resolve({ src: ifr.src });
                    }
                    resolve({ error: "No player iframe found" });
                }, 3000);
            });
        });
        
        console.log("Result:", result);
        
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await browser.close();
    }
}
testClick();
