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
            // Find all server buttons
            const servers = document.querySelectorAll('.server-video');
            let targetServer = null;
            
            // First try to find a dub server
            for (let s of servers) {
                if (s.getAttribute('data-type') === 'dub') {
                    targetServer = s;
                    break;
                }
            }
            // Fallback to sub
            if (!targetServer && servers.length > 0) targetServer = servers[0];
            
            if (!targetServer) return { error: "No servers found" };
            
            console.log("Clicking server...", targetServer.textContent);
            targetServer.click();
            
            // Wait for iframe
            return new Promise(resolve => {
                setTimeout(() => {
                    const iframes = document.querySelectorAll('iframe');
                    let srcs = [];
                    for (let ifr of iframes) {
                        if (!ifr.src.includes('recaptcha')) {
                            srcs.push(ifr.src);
                        }
                    }
                    if (srcs.length > 0) {
                        resolve({ src: srcs[0], all: srcs });
                    } else {
                        resolve({ error: "No player iframe found", all_iframes: Array.from(iframes).map(i => i.src) });
                    }
                }, 4000);
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
