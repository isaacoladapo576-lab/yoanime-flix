const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    page.on('request', req => console.log('REQ:', req.url()));
    
    await page.goto('https://dulo.tv/show/2691');
    await page.waitForTimeout(5000); // wait for JS to load the player
    
    const iframes = await page.evaluate(() => Array.from(document.querySelectorAll('iframe')).map(i => i.src));
    console.log('IFRAMES:', iframes);
    
    const html = await page.content();
    console.log('HTML contains vidcloud?', html.includes('vidcloud'));
    console.log('HTML contains vidsrc?', html.includes('vidsrc'));
    
    await browser.close();
})();
