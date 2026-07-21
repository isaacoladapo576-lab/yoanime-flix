const { chromium } = require('playwright');

async function intercept() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    
    let embedUrl = null;
    
    page.on('request', request => {
        const url = request.url();
        if (url.includes('megacloud') || url.includes('rabbit') || url.includes('embed') || url.includes('vidsrc')) {
            console.log("Found embed-like URL:", url);
            embedUrl = url;
        }
    });

    try {
        console.log("Navigating to watch page...");
        await page.goto('https://anichi.to/watch/jujutsu-kaisen-tv-8ssye?ep=1', { waitUntil: 'domcontentloaded' });
        
        // Wait up to 10 seconds for the network to idle and player to load
        await page.waitForTimeout(10000);
        
        // We can also extract the episode ID and call the ajax server list
        const watchMain = await page.$('#watch-main');
        if (watchMain) {
            const dataId = await watchMain.getAttribute('data-id');
            console.log("Watch main data-id:", dataId);
        }
        
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await browser.close();
    }
}
intercept();
