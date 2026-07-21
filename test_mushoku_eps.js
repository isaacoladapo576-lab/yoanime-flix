const { chromium } = require('playwright');
async function test() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('https://anichi.to/watch/mushoku-tensei-jobless-reincarnation-g20z1');
    await page.waitForTimeout(3000);
    const html = await page.evaluate(() => {
        const episodes = document.querySelectorAll('.ep-page-item, a[data-id], .ss-list a');
        return Array.from(episodes).map(e => e.outerHTML).slice(0, 5);
    });
    console.log(html);
    await browser.close();
}
test();
