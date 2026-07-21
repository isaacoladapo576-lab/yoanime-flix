const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    let m3u8Url = null;
    
    page.on('request', req => {
        const url = req.url();
        if (url.includes('.m3u8') || url.includes('.mp4') || url.includes('/stream/')) {
            console.log('FOUND STREAM:', url);
            m3u8Url = url;
        }
    });
    
    try {
        await page.goto('https://dulo.tv/movie/550', { waitUntil: 'domcontentloaded' }); // Fight Club
        await page.waitForTimeout(5000);
        
        const playBtn = await page.$('button[aria-label="Tap to start playback"]');
        if (playBtn) {
            console.log('Clicking play...');
            await playBtn.click();
            await page.waitForTimeout(10000); // give it time to load stream
        } else {
            console.log('No play button found, checking if autoplay...');
            await page.waitForTimeout(8000);
        }
    } catch (e) { console.error(e); }
    
    console.log('M3U8:', m3u8Url);
    await browser.close();
})();
