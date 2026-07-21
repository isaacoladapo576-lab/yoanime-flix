const { chromium } = require('playwright');
async function test() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('https://anichi.to/filter?keyword=Mushoku+Tensei');
    await page.waitForTimeout(3000);
    const links = await page.evaluate(() => {
        const el = document.querySelector('a.name');
        return el ? el.outerHTML : 'none';
    });
    console.log(links);
    await browser.close();
}
test();
