const { chromium } = require('playwright');
async function test() {
    const searchTitle = "Mushoku Tensei: Jobless Reincarnation";
    const targetSeason = 1;
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('https://anichi.to/filter?keyword=' + encodeURIComponent(searchTitle));
    await page.waitForTimeout(3000);
    
    const result = await page.evaluate(({ searchTitle, targetSeason }) => {
            const links = document.querySelectorAll('a.name');
            let bestLink = null;
            let bestScore = -1;
            let debug = [];

            const isSeasonMatch = (text, target) => {
                const lower = text.toLowerCase();
                if (target > 1) {
                    return lower.includes(`season ${target}`) || 
                           lower.includes(`${target}nd season`) || 
                           lower.includes(`${target}rd season`) || 
                           lower.includes(`${target}th season`) ||
                           lower.includes(`part ${target}`);
                } else {
                    const hasOtherSeason = /season\s*[2-9]|2nd|3rd|[4-9]th|part\s*[2-9]|ii|iii|iv/i.test(lower);
                    return !hasOtherSeason;
                }
            };

            for (let el of links) {
                const href = el.getAttribute('href');
                if (!href || !href.includes('/anime/')) continue;

                const text = (el.getAttribute('data-jp') || el.textContent).trim();
                const titleMatch = text.toLowerCase().includes(searchTitle.toLowerCase().replace(/ season \d+/i, '').trim());
                
                debug.push({ text, titleMatch });
                
                if (titleMatch) {
                    const seasonMatch = isSeasonMatch(text, targetSeason);
                    let score = 0;
                    if (seasonMatch) score += 10;
                    if (text.toLowerCase() === searchTitle.toLowerCase()) score += 5;
                    
                    debug.push({ text, score, seasonMatch });
                    
                    if (score > bestScore) {
                        bestScore = score;
                        bestLink = href;
                    }
                }
            }
            return { bestLink, bestScore, debug };
    }, { searchTitle, targetSeason });
    
    console.log(JSON.stringify(result, null, 2));
    await browser.close();
}
test();
