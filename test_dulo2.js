const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    page.on('request', req => {
        if(req.url().includes('vidsrc') || req.url().includes('vidcloud') || req.url().includes('embed') || req.url().includes('api/streams')) {
            console.log('INTERCEPTED:', req.url());
        }
    });
    
    await page.goto('https://dulo.tv/show/2691');
    await page.waitForTimeout(3000); 
    
    const playBtn = await page.$('button, a[href*="play"]');
    if (playBtn) {
        console.log('Clicking play button');
        await playBtn.click();
        await page.waitForTimeout(5000);
    } else {
        console.log('No play button found');
        const html = await page.content();
        console.log(html.substring(0, 1000));
    }
    
    const iframes = await page.evaluate(() => Array.from(document.querySelectorAll('iframe')).map(i => i.src));
    console.log('IFRAMES:', iframes);
    
    await browser.close();
})();
