const { chromium } = require('playwright');

async function scrapeAnichi(title, episodeStr, seasonStr, isDub) {
    const season = parseInt(seasonStr, 10) || 1;
    let searchTitle = title;
    // Anichi splits seasons into separate anime entries
    if (season > 1) {
        searchTitle = `${title} Season ${season}`;
    }

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    });
    
    try {
        const page = await context.newPage();
        
        // 1. Search for the anime
        const searchUrl = 'https://anichi.to/filter?keyword=' + encodeURIComponent(searchTitle);
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000); // Wait for AJAX results
        
        // Find the correct anime link
        const animeLink = await page.evaluate(({ searchTitle, targetSeason }) => {
            const links = document.querySelectorAll('a.name');
            let bestLink = null;
            let bestScore = -1;

            const isSeasonMatch = (text, target) => {
                const lower = text.toLowerCase();
                if (target > 1) {
                    return lower.includes(`season ${target}`) || 
                           lower.includes(`${target}nd season`) || 
                           lower.includes(`${target}rd season`) || 
                           lower.includes(`${target}th season`) ||
                           lower.includes(`part ${target}`);
                } else {
                    // For season 1, penalize if it explicitly mentions another season
                    const hasOtherSeason = /season\s*[2-9]|2nd|3rd|[4-9]th|part\s*[2-9]|ii|iii|iv/i.test(lower);
                    return !hasOtherSeason;
                }
            };

            for (let el of links) {
                const href = el.getAttribute('href');
                if (!href || !href.includes('/anime/')) continue;

                const textToSearch = `${el.getAttribute('data-jp') || ''} ${el.getAttribute('data-en') || ''} ${el.textContent}`.trim().toLowerCase();
                const titleMatch = textToSearch.includes(searchTitle.toLowerCase().replace(/ season \d+/i, '').trim());
                
                if (titleMatch) {
                    const seasonMatch = isSeasonMatch(textToSearch, targetSeason);
                    let score = 0;
                    if (seasonMatch) score += 10;
                    // give bonus if exact match to either jp or en
                    const jp = (el.getAttribute('data-jp') || '').toLowerCase();
                    const en = (el.getAttribute('data-en') || '').toLowerCase();
                    const st = searchTitle.toLowerCase();
                    if (jp === st || en === st || el.textContent.toLowerCase().trim() === st) score += 5;
                    
                    if (score > bestScore) {
                        bestScore = score;
                        bestLink = href;
                    }
                }
            }
            
            if (bestLink) return bestLink;
            
            // Fallback to old method
            const allLinks = document.querySelectorAll('a');
            for (let el of allLinks) {
                const href = el.getAttribute('href');
                if (href && href.includes('/anime/') && el.textContent.toLowerCase().includes(searchTitle.toLowerCase())) {
                    return href;
                }
            }
            return null;
        }, { searchTitle, targetSeason: season });
        
        if (!animeLink) throw new Error("Anime not found on Anichi");
        
        // 2. Go to the anime watch page
        let watchUrl = animeLink.startsWith('http') ? animeLink : 'https://anichi.to' + animeLink;
        if (!watchUrl.includes('/watch/')) {
            watchUrl = watchUrl.replace('/anime/', '/watch/');
        }
        
        // Navigate to the watch page first (without episode) to count available episodes
        await page.goto(watchUrl.replace(/\/ep-\d+$/, ''), { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);
        
        // Count available episodes on this page
        const maxEp = await page.evaluate(() => {
            const eps = document.querySelectorAll('a[data-num]');
            if (eps.length === 0) return 9999; // can't determine, assume it's fine
            let max = 0;
            for (let e of eps) {
                const num = parseInt(e.getAttribute('data-num'), 10);
                if (num > max) max = num;
            }
            return max;
        });
        
        let targetEp = parseInt(episodeStr, 10);
        
        // If requested episode exceeds available episodes, this anime is split into parts
        // Search for "Part 2" and adjust the episode number
        if (targetEp > maxEp) {
            console.log(`[Anichi] Episode ${targetEp} exceeds max ${maxEp} on this page. Looking for next part...`);
            targetEp = targetEp - maxEp; // adjust episode number for Part 2
            
            // Search with base title to find all parts
            const baseSearch = searchTitle.replace(/ season \d+/i, '').trim();
            await page.goto('https://anichi.to/filter?keyword=' + encodeURIComponent(baseSearch), { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(3000);
            
            const part2Link = await page.evaluate(({ baseSearch, targetSeason }) => {
                const links = document.querySelectorAll('a.name');
                let bestMatch = null;
                
                for (let el of links) {
                    const en = (el.getAttribute('data-en') || '').toLowerCase();
                    const jp = (el.getAttribute('data-jp') || '').toLowerCase();
                    const text = el.textContent.toLowerCase();
                    const href = el.getAttribute('href') || '';
                    const combined = `${en} ${jp} ${text} ${href}`;
                    const bt = baseSearch.toLowerCase();
                    
                    // Must match the base title
                    if (!combined.includes(bt)) continue;
                    
                    // Must have "part 2" indicator
                    const hasPart2 = combined.includes('part 2') || combined.includes('part-2') || combined.includes('cour 2');
                    if (!hasPart2) continue;
                    
                    // Season filtering: make sure we get the right season's Part 2
                    const hasSeasonMarker = /season[- ]?[2-9]|ii[^i]|iii|iv/i.test(combined);
                    
                    if (targetSeason === 1) {
                        // For Season 1: we want "Part 2" but NOT "Season 2 Part 2"
                        if (hasSeasonMarker) continue;
                        bestMatch = href;
                        break;
                    } else {
                        // For Season 2+: we want "Season X Part 2"
                        const seasonPattern = new RegExp(`season[- ]?${targetSeason}`, 'i');
                        if (seasonPattern.test(combined)) {
                            bestMatch = href;
                            break;
                        }
                    }
                }
                
                return bestMatch;
            }, { baseSearch, targetSeason: season });
            
            if (part2Link) {
                watchUrl = part2Link.startsWith('http') ? part2Link : 'https://anichi.to' + part2Link;
                if (!watchUrl.includes('/watch/')) {
                    watchUrl = watchUrl.replace('/anime/', '/watch/');
                }
                console.log(`[Anichi] Found Part 2: ${watchUrl}, adjusted episode: ${targetEp}`);
            } else {
                console.log(`[Anichi] Could not find Part 2, will try episode ${targetEp} on current page anyway`);
            }
        }
        
        // Now navigate to the correct episode
        const finalWatchUrl = watchUrl.replace(/\/ep-\d+$/, '') + '/ep-' + targetEp;
        await page.goto(finalWatchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);
        
        // Fallback: click the episode if URL navigation didn't select it
        await page.evaluate((ep) => {
            const eps = document.querySelectorAll('a[data-num]');
            for (let e of eps) {
                if (e.getAttribute('data-num') === String(ep) || e.textContent.trim() === String(ep)) {
                    if (!e.classList.contains('active')) {
                        e.click();
                    }
                    break;
                }
            }
        }, targetEp);
        
        // 4. Wait for servers to load
        await page.waitForTimeout(5000);
        
        // 5. Select the right server (Dub/Sub) and click play
        const embedUrl = await page.evaluate(async (dub) => {
            const servers = document.querySelectorAll('.server-video');
            let targetServer = null;
            
            // Try to match dub/sub
            const targetType = dub ? 'dub' : 'sub';
            for (let s of servers) {
                if (s.getAttribute('data-type') === targetType) {
                    targetServer = s;
                    break;
                }
            }
            // Fallback
            if (!targetServer && servers.length > 0) targetServer = servers[0];
            
            if (!targetServer) return null;
            
            targetServer.click();
            
            // Wait a moment for play button to appear or iframe to load
            await new Promise(r => setTimeout(r, 1000));
            
            // Click play button if it exists
            const playBtn = document.querySelector('#player-play');
            if (playBtn) playBtn.click();
            
            // Wait for iframe
            return new Promise(resolve => {
                let attempts = 0;
                const interval = setInterval(() => {
                    attempts++;
                    const iframes = document.querySelectorAll('iframe');
                    for (let ifr of iframes) {
                        if (ifr.src && !ifr.src.includes('recaptcha')) {
                            clearInterval(interval);
                            resolve(ifr.src);
                        }
                    }
                    if (attempts > 20) { // 10 seconds
                        clearInterval(interval);
                        resolve(null);
                    }
                }, 500);
            });
        }, isDub);
        
        if (embedUrl) {
            console.log(`[Anichi] Found embed URL: ${embedUrl}. Navigating to intercept stream...`);
            let streamUrl = null;
            
            // Listen for m3u8 or mp4 requests
            page.on('request', req => {
                const reqUrl = req.url();
                if ((reqUrl.includes('.m3u8') || reqUrl.includes('.mp4')) && !reqUrl.includes('trailer')) {
                    console.log(`[Anichi] Intercepted raw stream: ${reqUrl}`);
                    streamUrl = reqUrl;
                }
            });
            
            // Navigate to the embed frame with correct referer
            await page.goto(embedUrl, { referer: 'https://anichi.to/', waitUntil: 'domcontentloaded' });
            
            let waitTime = 0;
            while (!streamUrl && waitTime < 15000) {
                await page.waitForTimeout(500);
                waitTime += 500;
                
                // Try clicking any play buttons every 2 seconds if stream hasn't loaded
                if (waitTime % 2000 === 0) {
                    try {
                        const playBtn = await page.$('.play-button, .jw-video, video, [aria-label*="play" i]');
                        if (playBtn) await playBtn.click();
                    } catch(e) {}
                }
            }
            
            if (streamUrl) {
                return streamUrl;
            } else {
                throw new Error("Timeout waiting for m3u8 stream from embed");
            }
        } else {
            throw new Error("Could not extract embed URL from Anichi");
        }
        
    } finally {
        await browser.close();
    }
}

if (require.main === module) {
    const args = process.argv.slice(2);
    const title = args[0] || 'Jujutsu Kaisen';
    const ep = args[1] || '1';
    const isDub = args[2] === 'true';
    
    console.log(`Scraping Anichi for: ${title} Ep ${ep} (Dub: ${isDub})`);
    scrapeAnichi(title, ep, isDub).then(url => {
        console.log("SUCCESS:", url);
    }).catch(e => {
        console.error("FAILED:", e.message);
    });
}

module.exports = { scrapeAnichi };
