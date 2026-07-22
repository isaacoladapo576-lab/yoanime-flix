const ANICHI_ORIGIN = 'https://anichi.to';

function decodeHtml(value) {
    return String(value || '')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#(?:0*39|x0*27);/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function stripTags(value) {
    return decodeHtml(String(value || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function getAttribute(tag, name) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = String(tag || '').match(new RegExp(`\\s${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
    return decodeHtml(match ? (match[1] ?? match[2] ?? match[3] ?? '') : '');
}

function normalizeTitle(value) {
    return stripTags(value)
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

async function requestAnichi(url, referer = `${ANICHI_ORIGIN}/home`) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/html, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': referer,
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        const body = await response.text();
        if (!response.ok) throw new Error(`AniChi returned HTTP ${response.status}`);
        return body;
    } finally {
        clearTimeout(timeout);
    }
}

function parseJsonResult(body, label) {
    let data;
    try {
        data = JSON.parse(body);
    } catch {
        throw new Error(`${label} returned invalid JSON`);
    }
    if (Number(data.status || 200) !== 200 || data.result == null) {
        throw new Error(`${label} did not return a usable result`);
    }
    return data.result;
}

function scoreAnimeCandidate(candidateTitle, requestedTitle, season) {
    const candidate = normalizeTitle(candidateTitle);
    const requested = normalizeTitle(requestedTitle);
    const requestedBase = requested.replace(/\b(?:season|part)\s+\d+\b/g, '').trim();
    if (!candidate || !requestedBase) return -1000;

    let score = 0;
    if (candidate === requested) score += 100;
    if (candidate.includes(requested)) score += 45;
    if (candidate.includes(requestedBase)) score += 30;

    const words = requestedBase.split(' ').filter(word => word.length > 2);
    score += words.filter(word => candidate.includes(word)).length * 3;

    const explicitLaterSeason = /\b(?:season|part)\s+[2-9]\d*\b|\b(?:2nd|3rd|[4-9]th)\s+season\b/.test(candidate);
    if (season === 1) {
        score += explicitLaterSeason ? -60 : 25;
    } else {
        const seasonPattern = new RegExp(`\\b(?:season\\s+${season}|${season}(?:st|nd|rd|th)\\s+season)\\b`);
        score += seasonPattern.test(candidate) ? 60 : -30;
    }
    return score;
}

function findAnimeCandidates(html, title, season) {
    const cards = [];
    const regex = /<a\b([^>]*href\s*=\s*(?:"[^"]*\/anime\/[^"]+"|'[^']*\/anime\/[^']+'|[^\s>]*\/anime\/[^\s>]+)[^>]*)>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = regex.exec(html))) {
        const openTag = `<a ${match[1]}>`;
        const href = getAttribute(openTag, 'href');
        if (!href || !href.includes('/anime/')) continue;
        const imageTag = (match[2].match(/<img\b[^>]*>/i) || [])[0] || '';
        const titleTag = (match[2].match(/<[^>]+\bdata-en\s*=\s*(?:"[^"]*"|'[^']*')[^>]*>/i) || [])[0] || '';
        const candidateTitle = getAttribute(titleTag, 'data-en') || getAttribute(imageTag, 'alt') || stripTags(match[2]);
        cards.push({
            path: new URL(href, ANICHI_ORIGIN).pathname,
            candidateTitle,
            score: scoreAnimeCandidate(candidateTitle, title, season)
        });
    }
    cards.sort((a, b) => b.score - a.score);
    return cards;
}

function findAnimePath(html, title, season) {
    const cards = findAnimeCandidates(html, title, season);
    if (!cards.length || cards[0].score < 10) throw new Error('Anime not found on AniChi');
    return cards[0].path;
}

function findSeasonPartPaths(html, title, season) {
    const requestedBase = normalizeTitle(title).replace(/\b(?:season|part)\s+\d+\b/g, '').trim();
    const byPart = new Map();

    for (const card of findAnimeCandidates(html, title, season)) {
        const candidate = normalizeTitle(card.candidateTitle);
        if (card.score < 10 || !candidate.includes(requestedBase)) continue;

        const seasonMatch = candidate.match(/\bseason\s+(\d+)\b/);
        const ordinalSeasonMatch = candidate.match(/\b(\d+)(?:st|nd|rd|th)\s+season\b/);
        const candidateSeason = Number((seasonMatch || ordinalSeasonMatch || [])[1] || 1);
        if (candidateSeason !== season) continue;

        const partMatch = candidate.match(/\bpart\s+(\d+)\b/);
        const part = Number(partMatch ? partMatch[1] : 1);
        const current = byPart.get(part);
        if (!current || card.score > current.score) byPart.set(part, card);
    }

    return Array.from(byPart.entries())
        .sort(([partA], [partB]) => partA - partB)
        .map(([part, card]) => ({ part, path: card.path, title: card.candidateTitle }));
}

function mapEpisodeAcrossParts(episode, partCounts) {
    let remaining = Math.max(1, Number(episode) || 1);
    for (let partIndex = 0; partIndex < partCounts.length; partIndex++) {
        const count = Math.max(0, Number(partCounts[partIndex]) || 0);
        if (remaining <= count) return { partIndex, episode: remaining };
        remaining -= count;
    }
    return null;
}

function findTagByAttribute(html, attribute, value) {
    const tags = String(html || '').match(/<[^>]+>/g) || [];
    return tags.find(tag => getAttribute(tag, attribute) === String(value)) || null;
}

function extractResolvedUrl(value) {
    if (value == null) return null;
    if (typeof value === 'object') {
        for (const key of ['url', 'link', 'src', 'file', 'result', 'data']) {
            const found = extractResolvedUrl(value[key]);
            if (found) return found;
        }
        return null;
    }

    let text = decodeHtml(String(value)).replace(/\\\//g, '/').trim();
    if (!text) return null;
    if (text[0] === '{' || text[0] === '[') {
        try {
            const found = extractResolvedUrl(JSON.parse(text));
            if (found) return found;
        } catch (_) {}
    }

    const srcMatch = text.match(/(?:src|url|link)\s*=\s*["'](https?:\/\/[^"']+)/i);
    if (srcMatch) return srcMatch[1];
    const urlMatch = text.match(/https?:\/\/[^\s"'<>\\]+/i);
    return urlMatch ? urlMatch[0] : null;
}

function findServerLinkIds(serverHtml, isDub) {
    const desiredType = isDub ? 'dub' : 'sub';
    const findServerGroup = type => String(serverHtml).match(
        new RegExp(`<div\\b[^>]*data-type=["']${type}["'][^>]*>([\\s\\S]*?)<\\/div>`, 'i')
    );
    const serverGroup = findServerGroup(desiredType) || (!isDub ? findServerGroup('hsub') : null);
    const candidates = serverGroup
        ? Array.from(serverGroup[1].matchAll(/<([a-z][\w-]*)\b[^>]*data-link-id[^>]*>[\s\S]*?<\/\1>/gi), match => ({
            linkId: getAttribute(match[0], 'data-link-id'),
            label: decodeHtml(match[0].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
        })).filter(candidate => candidate.linkId)
        : [];

    if (candidates.length) {
        // AniChi's first dub mirror (VidPlay) sometimes resolves to a short
        // preview instead of the episode. Its HD mirror carries the complete
        // dub, so prefer that provider while preserving Sub's existing order.
        if (isDub) {
            const dubPreference = [/^HD(?:-|\b)/i, /^Vidstream/i, /^VidCloud/i, /^Kiwi/i, /^VidPlay/i];
            candidates.sort((a, b) => {
                const rank = candidate => {
                    const index = dubPreference.findIndex(pattern => pattern.test(candidate.label));
                    return index === -1 ? dubPreference.length : index;
                };
                return rank(a) - rank(b);
            });
        }
        return candidates.map(candidate => candidate.linkId);
    }

    const available = Array.from(String(serverHtml).matchAll(/data-type=["']([^"']+)["']/gi), match => match[1]).join(', ') || 'none';
    throw new Error(`No ${desiredType} server was found on AniChi (available: ${available})`);
}

function findServerLinkId(serverHtml, isDub) {
    return findServerLinkIds(serverHtml, isDub)[0];
}

function detectUnavailableEmbedResponse(status, body) {
    if ([404, 410].includes(Number(status)) || Number(status) >= 500) return true;
    const text = String(body || '').slice(0, 500000);
    return [
        /error\s*code\s*:?\s*410/i,
        /(?:can't|cannot)\s+find\s+the\s+file/i,
        /file\s+you\s+are\s+looking\s+for/i,
        /deleted\s+by\s+the\s+owner/i,
        /removed\s+due\s+to\s+(?:a\s+)?copyright/i,
        /(?:video|file|stream)\s+(?:is\s+)?(?:unavailable|not\s+found|removed)/i
    ].some(pattern => pattern.test(text));
}

async function validateEmbedUrl(url) {
    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return { available: false, reason: 'invalid embed URL' };
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return { available: false, reason: 'unsupported embed URL protocol' };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
        const response = await fetch(parsed.href, {
            redirect: 'follow',
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
                // Deliberately omit AniChi's Referer. The returned URL is loaded
                // from this app, so validating with AniChi's privileged referrer
                // would incorrectly accept hosts that show users a 410 page.
                'Accept': 'text/html,application/xhtml+xml,*/*'
            }
        });
        const contentType = response.headers.get('content-type') || '';
        if (/video|mpegurl|octet-stream/i.test(contentType)) {
            response.body?.cancel().catch(() => {});
            return { available: true };
        }
        const body = await response.text();
        if (detectUnavailableEmbedResponse(response.status, body)) {
            return { available: false, reason: `embed returned an unavailable-file page (${response.status})` };
        }

        // 401/403/429 pages may still work in the user's browser. Only reject
        // definitive missing-file responses; treat other responses as usable.
        return { available: true };
    } catch (error) {
        // A server-side probe can be blocked while the browser embed still works.
        return { available: null, reason: error.message };
    } finally {
        clearTimeout(timeout);
    }
}

async function loadEpisodeContext(animePath, referer) {
    const watchPath = animePath.replace('/anime/', '/watch/');
    const watchUrl = `${ANICHI_ORIGIN}${watchPath}/ep-1`;
    const watchHtml = await requestAnichi(watchUrl, referer);
    const watchTag = (watchHtml.match(/<[^>]+\bid=["']watch-main["'][^>]*>/i) || [])[0];
    const mangaId = getAttribute(watchTag, 'data-id');
    if (!/^\d+$/.test(mangaId)) throw new Error('AniChi anime id was not found');

    const episodesBody = await requestAnichi(
        `${ANICHI_ORIGIN}/ajax/episode/list/${mangaId}?style=&vrf=${mangaId}`,
        watchUrl
    );
    const episodesHtml = parseJsonResult(episodesBody, 'AniChi episode list');
    const episodeMap = new Map();
    const episodeTags = String(episodesHtml).match(/<[^>]*\bdata-num\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)[^>]*>/gi) || [];
    for (const tag of episodeTags) {
        const number = Number(getAttribute(tag, 'data-num'));
        const serverIds = getAttribute(tag, 'data-ids');
        if (Number.isInteger(number) && number > 0 && serverIds) episodeMap.set(number, serverIds);
    }
    const episodeCount = episodeMap.size ? Math.max(...episodeMap.keys()) : 0;
    if (!episodeCount) throw new Error('AniChi episode list was empty');
    return { watchUrl, episodeMap, episodeCount };
}

async function scrapeAnichiHttp(title, episodeStr, seasonStr, isDub) {
    const season = Math.max(1, parseInt(seasonStr, 10) || 1);
    const episode = Math.max(1, parseInt(episodeStr, 10) || 1);
    const searchTitle = season > 1 ? `${title} Season ${season}` : title;
    const filterUrl = `${ANICHI_ORIGIN}/filter?keyword=${encodeURIComponent(searchTitle)}`;

    const searchHtml = await requestAnichi(filterUrl);
    const primaryPath = findAnimePath(searchHtml, searchTitle, season);
    const seasonParts = findSeasonPartPaths(searchHtml, searchTitle, season);
    if (!seasonParts.length) seasonParts.push({ part: 1, path: primaryPath, title: searchTitle });
    if (!seasonParts.some(part => part.path === primaryPath)) {
        seasonParts.unshift({ part: 1, path: primaryPath, title: searchTitle });
    }

    const contexts = await Promise.all(seasonParts.map(part => loadEpisodeContext(part.path, filterUrl)));
    const mappedEpisode = mapEpisodeAcrossParts(episode, contexts.map(context => context.episodeCount));
    if (!mappedEpisode) {
        const available = contexts.reduce((total, context) => total + context.episodeCount, 0);
        throw new Error(`Episode ${episode} was not found on AniChi (available: ${available})`);
    }

    const context = contexts[mappedEpisode.partIndex];
    const watchUrl = context.watchUrl;
    const serverIds = context.episodeMap.get(mappedEpisode.episode);
    if (!serverIds) throw new Error(`Episode ${episode} was not found on AniChi`);

    const serverListBody = await requestAnichi(
        `${ANICHI_ORIGIN}/ajax/server/list?servers=${encodeURIComponent(serverIds)}`,
        watchUrl
    );
    const serverHtml = parseJsonResult(serverListBody, 'AniChi server list');
    const linkIds = findServerLinkIds(serverHtml, isDub).slice(0, 5);
    let unverifiedUrl = null;
    const failures = [];

    for (const linkId of linkIds) {
        try {
            const resolveBody = await requestAnichi(
                `${ANICHI_ORIGIN}/ajax/server?get=${encodeURIComponent(linkId)}`,
                watchUrl
            );
            let resolveData = resolveBody;
            try { resolveData = JSON.parse(resolveBody); } catch (_) {}
            const resolvedUrl = extractResolvedUrl(resolveData);
            if (!resolvedUrl) {
                failures.push(`${linkId}: no embed URL`);
                continue;
            }

            const validation = await validateEmbedUrl(resolvedUrl);
            if (validation.available === true) return resolvedUrl;
            if (validation.available == null && !unverifiedUrl) unverifiedUrl = resolvedUrl;
            failures.push(`${linkId}: ${validation.reason || 'unavailable'}`);
        } catch (error) {
            failures.push(`${linkId}: ${error.message}`);
        }
    }

    // Do not discard a potentially working browser-only host merely because
    // its server-side validation request was blocked or timed out.
    if (unverifiedUrl) return unverifiedUrl;

    const desiredType = isDub ? 'dub' : 'sub';
    throw new Error(`No working ${desiredType} mirror was found on AniChi (${failures.join('; ')})`);
}

async function scrapeAnichiBrowser(title, episodeStr, seasonStr, isDub) {
    // Keep Playwright out of lightweight/serverless bundles. It is only needed
    // if AniChi's direct HTTP endpoints stop working.
    const { chromium } = require('play' + 'wright');
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
            return embedUrl;
        } else {
            throw new Error("Could not extract embed URL from Anichi");
        }
        
    } finally {
        await browser.close();
    }
}

async function scrapeAnichi(title, episodeStr, seasonStr, isDub) {
    // Production uses the lightweight HTTP resolver. Do not fall back to a
    // browser process: hosted instances may intentionally omit Playwright.
    return scrapeAnichiHttp(title, episodeStr, seasonStr, isDub);
}

if (require.main === module) {
    const args = process.argv.slice(2);
    const title = args[0] || 'Jujutsu Kaisen';
    const ep = args[1] || '1';
    const season = args[2] || '1';
    const isDub = args[3] === 'true';
    
    console.log(`Scraping Anichi for: ${title} S${season} E${ep} (Dub: ${isDub})`);
    scrapeAnichi(title, ep, season, isDub).then(url => {
        console.log("SUCCESS:", url);
    }).catch(e => {
        console.error("FAILED:", e.message);
    });
}

module.exports = {
    detectUnavailableEmbedResponse,
    extractResolvedUrl,
    findAnimePath,
    findSeasonPartPaths,
    findServerLinkId,
    findServerLinkIds,
    mapEpisodeAcrossParts,
    scrapeAnichi,
    scrapeAnichiBrowser,
    scrapeAnichiHttp
};
