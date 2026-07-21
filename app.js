/* ============================================
   YoAnime.Flx — App Logic v14 (Optimised)
   - Parallel data loading (no more lag)
   - 15 live servers, best working ones first
   - IMDB ID mapping for accurate Anime
   ============================================ */

'use strict';

const TMDB_KEY = '15d2ea6d0dc1d476efbca3eba2b9bbfb';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p/';

// Helper to get image URL
const getImg = (path, size) => path ? `${IMG_BASE}${size === 'poster' ? 'w500' : 'w1280'}${path}` : null;

// ============================================
// YoAnime.Flx — Self-Hosted Streaming Logic
// ============================================

// ============================================
// State
// ============================================
let currentItem   = null;
let currentSeason = 1;
let currentEp     = 1;
let serverIndex   = 0;
let autoTimer     = null;
let isStreaming   = false;
let hlsInstance   = null;
let playbackLoadId = 0;

let heroItems  = [];
let heroIndex  = 0;
let heroTimer  = null;
let modalItem  = null;

// Cache loaded rows so we don't over-fetch TMDB
const stateCache = {
    trending: [], anime: [], shows: [], movies: [],
    action: [], comedy: [], horror: [], mylist: []
};
const itemRegistry = {};

// ============================================
// Init & Fetch Data
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    setupNavbarScroll();
    loadAllData();
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { closePlayer(); closeModal(); }
    });
});

async function apiFetch(endpoint) {
    try {
        const res = await fetch(`${TMDB_BASE}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${TMDB_KEY}`);
        const data = await res.json();
        return data.results || data;
    } catch (e) {
        console.error('TMDB Fetch Error:', e);
        return [];
    }
}

async function fetchMulti(endpoint, pages = 3) {
    let all = [];
    for(let i = 1; i <= pages; i++) {
        const res = await apiFetch(`${endpoint}&page=${i}`);
        if(res && res.length) all = all.concat(res);
    }
    return all;
}

// Convert TMDB item to our normalized format
function normalizeItem(t, forcedType = null) {
    if (!t) return null;
    const isTV = (forcedType === 'tv' || t.media_type === 'tv' || t.name || t.original_name);
    
    // Check if it's anime (Genre 16 = Animation, original language Japanese)
    const isAnime = (t.original_language === 'ja' && t.genre_ids && t.genre_ids.includes(16));

    const item = {
        id: String(t.id),
        tmdbId: String(t.id),
        type: isTV ? 'show' : 'movie',
        isAnime: isAnime,
        title: t.title || t.name || t.original_name || t.original_title,
        description: t.overview || 'No description available.',
        rating: (t.vote_average || 0).toFixed(1),
        year: (t.release_date || t.first_air_date || '').split('-')[0] || 'TBA',
        poster: getImg(t.poster_path, 'poster'),
        backdrop: getImg(t.backdrop_path, 'backdrop'),
        seasons: 1, 
        episodesPerSeason: [] 
    };
    
    // Save to registry for safe onclick handlers
    itemRegistry[item.id] = item;
    return item;
}

async function loadAllData() {
    // Show skeleton placeholders immediately so the page doesn't look blank
    renderSkeletons('trending-row', 15);
    renderSkeletons('anime-row', 15);
    renderSkeletons('shows-row', 15);
    renderSkeletons('movies-row', 15);
    renderSkeletons('action-row', 15);
    renderSkeletons('comedy-row', 15);
    renderSkeletons('horror-row', 15);

    loadMyList();

    // ⚡ PERFORMANCE: Staggered Loading
    // Fetch Trending and Anime FIRST so the page is instantly interactive
    const [trendData, animeData] = await Promise.all([
        apiFetch('/trending/all/day'),
        fetchMulti('/discover/tv?with_genres=16&with_original_language=ja&sort_by=popularity.desc', 3)
    ]);

    // Trending
    stateCache.trending = trendData.filter(x => x.poster_path).map(x => normalizeItem(x));
    renderRow('trending-row', stateCache.trending);
    if (stateCache.trending.length > 0) initHero(stateCache.trending.slice(0, 6));

    // Anime
    stateCache.anime = animeData.filter(x => x.poster_path).map(x => normalizeItem(x, 'tv'));
    renderRow('anime-row', stateCache.anime);

    // Fetch the rest silently in the background
    Promise.all([
        fetchMulti('/discover/tv?without_genres=16&sort_by=popularity.desc', 3),
        fetchMulti('/discover/movie?sort_by=popularity.desc', 3),
        fetchMulti('/discover/movie?with_genres=28&sort_by=popularity.desc', 3), // Action
        fetchMulti('/discover/movie?with_genres=35&sort_by=popularity.desc', 3), // Comedy
        fetchMulti('/discover/movie?with_genres=27&sort_by=popularity.desc', 3)  // Horror
    ]).then(([showsData, moviesData, actionData, comedyData, horrorData]) => {
        stateCache.shows = showsData.filter(x => x.poster_path).map(x => normalizeItem(x, 'tv'));
        renderRow('shows-row', stateCache.shows);
        
        stateCache.movies = moviesData.filter(x => x.poster_path).map(x => normalizeItem(x, 'movie'));
        renderRow('movies-row', stateCache.movies);
        
        stateCache.action = actionData.filter(x => x.poster_path).map(x => normalizeItem(x, 'movie'));
        renderRow('action-row', stateCache.action);

        stateCache.comedy = comedyData.filter(x => x.poster_path).map(x => normalizeItem(x, 'movie'));
        renderRow('comedy-row', stateCache.comedy);

        stateCache.horror = horrorData.filter(x => x.poster_path).map(x => normalizeItem(x, 'movie'));
        renderRow('horror-row', stateCache.horror);
    });
}

// ============================================
// Bookmarks (My List) Logic
// ============================================
function loadMyList() {
    try {
        const saved = JSON.parse(localStorage.getItem('yoanime_bookmarks')) || [];
        stateCache.mylist = saved;
        saved.forEach(item => { itemRegistry[item.id] = item; });
        
        const mylistSection = document.getElementById('mylist-section');
        if (stateCache.mylist.length > 0) {
            mylistSection.style.display = '';
            renderRow('mylist-row', stateCache.mylist);
        } else {
            mylistSection.style.display = 'none';
        }
    } catch(e) { console.error("Error loading bookmarks:", e); }
}

function toggleBookmarkModal() {
    if (!modalItem) return;
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem('yoanime_bookmarks')) || []; } catch(e){}
    
    const index = saved.findIndex(x => String(x.id) === String(modalItem.id));
    if (index > -1) {
        saved.splice(index, 1);
        document.getElementById('modal-list-btn').textContent = '+ My List';
    } else {
        saved.unshift(modalItem);
        document.getElementById('modal-list-btn').textContent = '✓ In My List';
    }
    
    localStorage.setItem('yoanime_bookmarks', JSON.stringify(saved));
    loadMyList(); // Re-render the row
}

// Fetch full TV details (for Seasons/Episodes)
async function fetchFullTVDetails(item) {
    if (item.type !== 'show' && item.type !== 'anime') return item;
    
    if (item.episodesPerSeason && item.episodesPerSeason.length > 0) return item;

    const full = await apiFetch(`/tv/${item.tmdbId}?append_to_response=external_ids`);
    if (full && full.seasons) {
        if (full.external_ids && full.external_ids.imdb_id) {
            item.imdbId = full.external_ids.imdb_id;
        }
        const validSeasons = full.seasons.filter(s => s.season_number > 0);
        item.seasons = validSeasons.length;
        item.episodesPerSeason = [];
        for (let i = 0; i < item.seasons; i++) {
            item.episodesPerSeason[i] = validSeasons[i].episode_count || 12;
        }
    }
    return item;
}

// ============================================
// Navbar & Sections
// ============================================
function setupNavbarScroll() {
    const nav = document.getElementById('navbar');
    window.addEventListener('scroll', () =>
        nav.classList.toggle('scrolled', window.scrollY > 40), { passive: true });
}

function toggleMenu() {
    document.getElementById('hamburger').classList.toggle('open');
    document.getElementById('mobile-menu').classList.toggle('open');
}
function closeMobileMenu() {
    document.getElementById('hamburger').classList.remove('open');
    document.getElementById('mobile-menu').classList.remove('open');
}

function showSection(section) {
    ['home','anime','shows','movies','mylist'].forEach(s => {
        const el = document.getElementById(`nav-${s}`);
        if (el) el.classList.toggle('active', s === section);
    });

    // We don't hide mylist-section generally, but if they click a specific section, we do.
    ['trending-section','anime-section','shows-section','movies-section','action-section','comedy-section','horror-section','mylist-section'].forEach(id => {
        const el = document.getElementById(id);
        // Only show mylist if it has items, otherwise hide it even on home
        if (id === 'mylist-section' && stateCache.mylist.length === 0) {
            if(el) el.style.display = 'none';
        } else {
            if (el) el.style.display = '';
        }
    });

    let heroData = [];
    if (section === 'anime') {
        ['shows-section','movies-section','trending-section','action-section','comedy-section','horror-section','mylist-section'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).style.display = 'none'; });
        heroData = stateCache.anime.slice(0,6);
    } else if (section === 'shows') {
        ['anime-section','movies-section','trending-section','action-section','comedy-section','horror-section','mylist-section'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).style.display = 'none'; });
        heroData = stateCache.shows.slice(0,6);
    } else if (section === 'movies') {
        ['anime-section','shows-section','trending-section','action-section','comedy-section','horror-section','mylist-section'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).style.display = 'none'; });
        heroData = stateCache.movies.slice(0,6);
    } else if (section === 'mylist') {
        ['anime-section','shows-section','trending-section','action-section','comedy-section','horror-section'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).style.display = 'none'; });
        heroData = stateCache.mylist.slice(0,6);
    } else if (section === 'search') {
        ['anime-section','shows-section','trending-section','action-section','comedy-section','horror-section','mylist-section'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).style.display = 'none'; });
    } else {
        heroData = stateCache.trending.slice(0,6);
    }

    if (heroData.length > 0) initHero(heroData);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
function goHome() { showSection('home'); }

// ============================================
// Rendering
// ============================================
function renderRow(rowId, items) {
    const row = document.getElementById(rowId);
    if (!row) return;
    row.innerHTML = items.map(cardHTML).join('');
}

// Show shimmering skeleton placeholders while data loads
function renderSkeletons(rowId, count = 10) {
    const row = document.getElementById(rowId);
    if (!row) return;
    row.innerHTML = Array(count).fill(0).map(() => `
    <div class="card skeleton-card skeleton">
    </div>`).join('');
}

function cardHTML(item) {
    return `
    <div class="card" onclick="openPlayerById('${item.id}')">
        ${item.poster
            ? `<img class="card-img" src="${item.poster}" alt="${escapeHtml(item.title)}" loading="lazy"
                    onerror="this.src=''; this.style.background='#111';">`
            : `<div class="card-img" style="background:#111; display:flex; align-items:center; justify-content:center; text-align:center; padding:10px;">${escapeHtml(item.title)}</div>`
        }
        <div class="card-overlay">
            <div class="card-title">${escapeHtml(item.title)}</div>
            <div class="card-meta">
                <span class="card-rating">⭐ ${item.rating}</span>
                <span>${item.year}</span>
            </div>
        </div>
    </div>`;
}

function escapeHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function scrollRow(rowId, dir) {
    const row = document.getElementById(rowId);
    if (row) row.scrollBy({ left: dir * 600, behavior: 'smooth' });
}

// ============================================
// Hero Carousel
// ============================================
function initHero(items) {
    if (heroTimer) clearInterval(heroTimer);
    heroItems = items;
    heroIndex = 0;
    renderHero(heroItems[0]);
    heroTimer = setInterval(nextHeroSlide, 8000);
}

function renderHero(item) {
    if (!item) return;
    const typeLabel = item.isAnime ? 'Anime' : item.type === 'movie' ? 'Movie' : 'TV Show';

    document.getElementById('hero-title').textContent = item.title;
    document.getElementById('hero-desc').textContent  = item.description;
    document.getElementById('hero-badges').innerHTML  = `
        <span class="badge">${typeLabel}</span>
        <span class="badge">⭐ ${item.rating}</span>
        <span class="badge">${item.year}</span>`;

    const bg = document.getElementById('hero-bg');
    if (item.backdrop) {
        const i = new Image();
        i.onload  = () => { bg.style.backgroundImage = `url(${item.backdrop})`; };
        i.onerror = () => { if (item.poster) bg.style.backgroundImage = `url(${item.poster})`; };
        i.src = item.backdrop;
    }
}

function goToHero(i) {
    heroIndex = i;
    renderHero(heroItems[heroIndex]);
    if (heroTimer) clearInterval(heroTimer);
    heroTimer = setInterval(nextHeroSlide, 8000);
}
function nextHeroSlide() { heroIndex = (heroIndex+1) % heroItems.length; renderHero(heroItems[heroIndex]); }
function prevHero() { heroIndex = (heroIndex-1+heroItems.length) % heroItems.length; renderHero(heroItems[heroIndex]); if (heroTimer) clearInterval(heroTimer); heroTimer = setInterval(nextHeroSlide, 8000); }
function playHero()  { if (heroItems[heroIndex]) openPlayer(heroItems[heroIndex]); }
function infoHero()  { if (heroItems[heroIndex]) openModal(heroItems[heroIndex]); }

// ============================================
// Modal
// ============================================
function openModalById(id) {
    const item = itemRegistry[id];
    if (item) openModal(item);
}

// Handle global toggleMyList from HTML button
window.toggleMyList = function() {
    toggleBookmarkModal();
};

async function openModal(item) {
    if (!item) return;
    
    // If it's a TV show, fetch full details to get seasons BEFORE playing
    if (item.type === 'show' || item.isAnime) {
        document.getElementById('modal-title').textContent = "Loading...";
        item = await fetchFullTVDetails(item);
    }
    
    modalItem = item;
    
    const typeLabel = item.isAnime ? 'Anime' : item.type === 'movie' ? 'Movie' : 'TV Show';
    
    document.getElementById('modal-title').textContent = modalItem.title;
    document.getElementById('modal-desc').textContent  = modalItem.description;
    
    document.getElementById('modal-backdrop').src = modalItem.backdrop || modalItem.poster || '';
    document.getElementById('modal-backdrop').alt = modalItem.title;
    
    document.getElementById('modal-meta').innerHTML    = `
        <span class="badge">${typeLabel}</span>
        <span style="color:#46d369; font-weight:600;">⭐ ${modalItem.rating}/10</span>
        <span>${modalItem.year}</span>
        ${modalItem.seasons && modalItem.type !== 'movie' ? `<span>${modalItem.seasons} Season${modalItem.seasons>1?'s':''}</span>` : ''}`;
        
    // Check bookmark status
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem('yoanime_bookmarks')) || []; } catch(e){}
    const isBookmarked = saved.some(x => String(x.id) === String(modalItem.id));
    if (isBookmarked) document.getElementById('modal-list-btn').textContent = '✓ In My List';
    else document.getElementById('modal-list-btn').textContent = '+ My List';
        
    document.getElementById('item-modal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('item-modal').classList.remove('open');
    document.body.style.overflow = '';
}
function playModal() { closeModal(); if (modalItem) openPlayer(modalItem); }

function openPlayerById(id) {
    const item = itemRegistry[id];
    if (item) openPlayer(item);
}

// ============================================
// Player  — Auto-Server Detection
// ============================================
async function openPlayer(item) {
    // Ensure we have full details before playing
    if (item.type === 'show' || item.isAnime) {
        item = await fetchFullTVDetails(item);
    }
    
    currentItem   = item;
    currentSeason = 1;
    currentEp     = 1;
    serverIndex   = 0;
    currentServerIndex = 0;
    serverSelectionLocked = false;
    isStreaming   = false;

    document.getElementById('player-page').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    document.getElementById('player-title').textContent  = item.title;

    const epNav   = document.getElementById('episode-nav');
    const epBadge = document.getElementById('episode-indicator');
    if (item.type === 'show' || item.isAnime) {
        epNav.style.display   = 'flex';
        epBadge.style.display = '';
        updateEpisodeNav();
    } else {
        epNav.style.display   = 'none';
        epBadge.style.display = 'none';
    }

    const dubToggle = document.getElementById('dub-toggle-btn');
    if (item.isAnime) {
        dubToggle.style.display = 'inline-block';
        dubToggle.textContent = isDub ? 'Dub' : 'Sub';
    } else {
        dubToggle.style.display = 'none';
    }

    loadVideo();
}

// isDub controls Sub vs Dub — toggled by buttons in the player UI
let isDub = false;

function toggleDub() {
    isDub = !isDub;
    document.getElementById('dub-toggle-btn').textContent = isDub ? 'Dub' : 'Sub';
    loadVideo();
}

async function resolveAniChiStream(item, season, episode) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    const productionApiOrigin = window.ANICHI_API_ORIGIN || 'https://yoanime-flix.onrender.com';
    const params = new URLSearchParams({
        title: item.title,
        season: String(season),
        ep: String(episode),
        isDub: String(isDub),
        reqId: `${playbackLoadId}-${Date.now()}`
    });
    const apiPath = `/api/scrape/anichi?${params}`;
    const candidates = [apiPath];
    if (window.location.origin !== productionApiOrigin) {
        candidates.push(`${productionApiOrigin}${apiPath}`);
    }

    try {
        let lastError = new Error('AniChi API is unreachable');
        for (const apiUrl of candidates) {
            try {
                const response = await fetch(apiUrl, {
                    cache: 'no-store',
                    signal: controller.signal
                });
                const data = await response.json().catch(() => ({}));
                if (response.ok && data.url) {
                    return { url: data.url, iframe: true };
                }
                lastError = new Error(data.error || `AniChi returned HTTP ${response.status}`);
            } catch (error) {
                if (error.name === 'AbortError') throw error;
                lastError = error;
            }
        }
        throw lastError;
    } finally {
        clearTimeout(timeout);
    }
}

function getCurrentStreamServers() {
    if (!window.StreamSources) return [];
    const type = currentItem.isAnime ? 'anime' : currentItem.type;
    const servers = window.StreamSources.buildStreamSources({
        type,
        title: currentItem.title,
        tmdbId: currentItem.tmdbId,
        anilistId: currentItem.anilistId,
        season: currentSeason,
        episode: currentEp,
        audio: isDub ? 'dub' : 'sub'
    }).map(source => ({ ...source, url: () => source.url }));

    if (currentItem.isAnime) {
        servers.splice(Math.min(1, servers.length), 0, {
            id: 'anichi',
            name: 'Server 2 (AniChi)',
            supportsDub: true,
            iframe: true,
            isProxy: true,
            url: resolveAniChiStream
        });

        return servers.map((server, index) => ({
            ...server,
            name: server.id === 'anichi'
                ? `Server ${index + 1} (AniChi)`
                : server.name.replace(/^Server \d+/, `Server ${index + 1}`)
        }));
    }

    return servers;
}

async function checkStreamEndpoint(url) {
    if (url.startsWith('/')) return true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
        const response = await fetch(`/api/health?url=${encodeURIComponent(url)}`, {
            cache: 'no-store',
            signal: controller.signal
        });
        if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return null;
        const result = await response.json();
        return typeof result.ok === 'boolean' ? result.ok : null;
    } catch (_) {
        // Static deployments do not expose the health route; iframe fallback still works there.
        return null;
    } finally {
        clearTimeout(timer);
    }
}

let currentServerIndex = 0;
let serverSelectionLocked = false;
let _loadVideoDebounceTimer = null;

function loadVideo() {
    // Debounce: wait 500ms so rapid episode/season changes only trigger one scrape
    if (_loadVideoDebounceTimer) clearTimeout(_loadVideoDebounceTimer);
    
    // Immediately bump the playback ID to invalidate any in-flight loads
    ++playbackLoadId;
    
    // Show loading state immediately for responsiveness
    const loading = document.getElementById('player-loading');
    const loadTxt = document.getElementById('loading-text');
    const iframe = document.getElementById('player-iframe');
    if (loading) loading.classList.remove('hidden');
    if (loadTxt) loadTxt.innerHTML = `Preparing stream…`;
    if (iframe) { iframe.style.display = 'none'; iframe.src = ''; }
    isStreaming = false;
    
    _loadVideoDebounceTimer = setTimeout(() => {
        _loadVideoDebounceTimer = null;
        _loadVideoInternal();
    }, 500);
}

async function _loadVideoInternal() {
    if (autoTimer) clearTimeout(autoTimer);
    const loadId = playbackLoadId;

    isStreaming  = false;
    const iframe   = document.getElementById('player-iframe');
    const loading  = document.getElementById('player-loading');
    const loadTxt  = document.getElementById('loading-text');

    loadTxt.innerHTML   = `Finding best stream…`;
    loading.classList.remove('hidden');
    iframe.style.display = 'none';
    iframe.src = '';
    
    // Resolve AniList ID once if anime
    if (currentItem.isAnime && !currentItem.anilistId) {
        try {
            const query = `query ($search: String) { Media(search: $search, type: ANIME) { id } }`;
            const res = await fetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, variables: { search: currentItem.title } })
            });
            const data = await res.json();
            currentItem.anilistId = data?.data?.Media?.id;
        } catch (e) {
            console.warn('[Player] Anilist lookup failed:', e);
        }
    }

    if (loadId !== playbackLoadId || !currentItem) return;

    const servers = getCurrentStreamServers();
    buildServerSelect(servers);

    if (!servers.length) {
        showPlayerError(`"${currentItem.title}" could not be mapped to a stream source.`);
        return;
    }

    // ── Fallback cascade ──────────────────────────────────────
    const startIndex = currentServerIndex;
    const allowFallback = !serverSelectionLocked;
    let attempts = 0;
    const maxAttempts = allowFallback ? servers.length : 1;

    function handleServerFailure(srv, message) {
        if (!allowFallback) {
            showPlayerError(`${srv.name} failed: ${message}. Please choose another server or try again.`);
            return;
        }
        tryServer(currentServerIndex + 1);
    }

    async function tryServer(index) {
        if (loadId !== playbackLoadId || !currentItem) return;
        if (attempts >= maxAttempts) {
            showPlayerError('All servers failed. Please try again later.');
            return;
        }
        attempts++;
        currentServerIndex = index % servers.length;
        const srv = servers[currentServerIndex];
        buildServerSelect(servers);

        // Update the dropdown to reflect current attempt
        const sel = document.getElementById('server-select');
        if (sel) sel.value = currentServerIndex;

        loadTxt.innerHTML = `Trying ${srv.name}… <span style="color:#555;font-size:0.75rem">(${attempts}/${maxAttempts})</span>`;
        loading.classList.remove('hidden');
        iframe.style.display = 'none';
        iframe.src = '';
        isStreaming = false;

        try {
            let embedUrl = '';

            if (srv.isProxy) {
                const result = typeof srv.url === 'function' ? await srv.url(currentItem, currentSeason, currentEp) : null;
                if (!result) throw new Error("Scraper returned no stream");
                if (result.iframe === false) {
                    playRawStream(result.url, result.type || 'mp4');
                    return;
                }
                embedUrl = result.url;
            } else if (srv.iframe === false) {
                const result = typeof srv.url === 'function' ? await srv.url(currentItem, currentSeason, currentEp) : null;
                if (!result) throw new Error("Scraper returned no stream");
                playRawStream(result.rawUrl, result.type);
                return;
            } else {
                embedUrl = typeof srv.url === 'function' ? await srv.url(currentItem, currentSeason, currentEp) : srv.url;
            }

            if (!embedUrl || embedUrl === "undefined" || embedUrl === "null") {
                throw new Error("Resolved embed URL is invalid or undefined");
            }

            console.log(`[Player] Attempt ${attempts}: ${srv.name} → ${embedUrl}`);

            // Clear previous handlers
            iframe.onload = null;
            iframe.onerror = null;

            if (window._currentFallbackInterval) clearInterval(window._currentFallbackInterval);
            const spinnerEl = document.getElementById('loading-spinner');
            if (spinnerEl) spinnerEl.textContent = '30';
            let timeLeft = 30;
            window._currentFallbackInterval = setInterval(() => {
                timeLeft--;
                if (spinnerEl && timeLeft > 0) spinnerEl.textContent = timeLeft;
                if (timeLeft <= 0) clearInterval(window._currentFallbackInterval);
            }, 1000);

            let settled = false;
            const fallbackTimeout = setTimeout(() => {
                if (loadId === playbackLoadId && !settled && !isStreaming) {
                    settled = true;
                    clearInterval(window._currentFallbackInterval);
                    if (spinnerEl) spinnerEl.textContent = '';
                    console.warn(`[Player] ${srv.name} timed out after 30s, trying next…`);
                    handleServerFailure(srv, 'the player timed out');
                }
            }, 30000);

            iframe.onerror = () => {
                if (loadId !== playbackLoadId || settled) return;
                settled = true;
                clearTimeout(fallbackTimeout);
                clearInterval(window._currentFallbackInterval);
                if (spinnerEl) spinnerEl.textContent = '';
                console.warn(`[Player] ${srv.name} errored, trying next…`);
                handleServerFailure(srv, 'the embedded player could not load');
            };

            iframe.onload = () => {
                if (loadId !== playbackLoadId || settled) return;
                settled = true;
                clearTimeout(fallbackTimeout);
                clearInterval(window._currentFallbackInterval);
                if (spinnerEl) spinnerEl.textContent = '';
                loading.classList.add('hidden');
                iframe.style.display = 'block';
                isStreaming = true;
                console.log(`[Player] ✓ ${srv.name} loaded successfully`);
            };

            iframe.src = embedUrl;

        } catch (err) {
            if (loadId !== playbackLoadId) return;
            console.warn(`[Player] ${srv.name} threw: ${err.message}, trying next…`);
            handleServerFailure(srv, err.message);
        }
    }

    tryServer(startIndex);
}

// Play a raw HLS or MP4 stream directly using hls.js
function playRawStream(url, type) {
    const loading = document.getElementById('player-loading');
    const iframe  = document.getElementById('player-iframe');
    iframe.style.display = 'none';
    iframe.src = '';

    // Get or create native video element
    let video = document.getElementById('native-player');
    if (!video) {
        video = document.createElement('video');
        video.id = 'native-player';
        video.controls = true;
        video.autoplay = true;
        video.style.cssText = 'width:100%;height:100%;background:#000;display:block;';
        iframe.parentNode.insertBefore(video, iframe);
    }
    video.style.display = 'block';

    if (type === 'hls' || url.includes('.m3u8')) {
        if (window.Hls && Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(url);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                loading.classList.add('hidden');
                isStreaming = true;
                video.play();
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = url;
            loading.classList.add('hidden');
            isStreaming = true;
        }
    } else {
        video.src = url;
        video.oncanplay = () => { loading.classList.add('hidden'); isStreaming = true; };
    }
}

function buildServerSelect(servers = getCurrentStreamServers()) {
    const sw = document.getElementById('server-dropdown');
    const sel = document.getElementById('server-selected');
    const opts = document.getElementById('server-options');
    if (!sw || !sel || !opts) return;
    
    if (opts.children.length !== servers.length) {
        opts.innerHTML = '';
        servers.forEach((s, i) => {
            const div = document.createElement('div');
            div.className = 'dropdown-item';
            div.textContent = s.name;
            div.onclick = (e) => {
                e.stopPropagation();
                sw.classList.remove('open');
                changeServer(i);
            };
            opts.appendChild(div);
        });
        currentServerIndex = 0;
    }
    
    if (servers[currentServerIndex]) {
        sel.textContent = servers[currentServerIndex].name;
    }
    Array.from(opts.children).forEach((child, idx) => {
        child.classList.toggle('active', idx === currentServerIndex);
    });

    const dubToggle = document.getElementById('dub-toggle-btn');
    if (dubToggle) {
        if (!currentItem.isAnime) {
            dubToggle.style.display = 'none';
        } else {
            const srv = servers[currentServerIndex];
            dubToggle.style.display = 'block';
            dubToggle.textContent = isDub ? 'Dub' : 'Sub';
            dubToggle.classList.toggle('active', isDub);
            // Hide if not supported
            if (srv && !srv.supportsDub) {
                dubToggle.style.display = 'none';
            }
        }
    }
}

window.toggleDropdown = function() {
    document.getElementById('server-dropdown').classList.toggle('open');
};



window.setDub = function(dub) {
    isDub = dub;
    document.getElementById('btn-sub').classList.toggle('active', !dub);
    document.getElementById('btn-dub').classList.toggle('active', dub);
    loadVideo();
};

window.changeServer = function(index) {
    currentServerIndex = parseInt(index);
    serverSelectionLocked = true;
    loadVideo();
};

function showPlayerError(msg) {
    const loading = document.getElementById('player-loading');
    const loadTxt = document.getElementById('loading-text');
    const iframe  = document.getElementById('player-iframe');
    iframe.style.display = 'none';
    loading.classList.remove('hidden');
    loadTxt.innerHTML = `
        <div style="text-align:center;padding:20px;">
            <div style="font-size:2rem;margin-bottom:12px;">⚠️</div>
            <div style="color:#fff;font-weight:700;margin-bottom:8px;">Stream Unavailable</div>
            <div style="color:#9898b0;font-size:0.85rem;margin-bottom:20px;">
                ${msg}
            </div>
        </div>`;
}

function closePlayer() {
    if (autoTimer) clearTimeout(autoTimer);
    playbackLoadId++;
    const iframe = document.getElementById('player-iframe');
    iframe.onload = null;
    iframe.onerror = null;
    iframe.src = '';
    iframe.style.display = 'none';
    
    document.getElementById('player-page').style.display = 'none';
    document.body.style.overflow = '';
    currentItem = null;
    isStreaming = false;
}

// ============================================
// Episode Nav
// ============================================
function updateEpisodeNav() {
    const badge = document.getElementById('episode-indicator');
    if (badge) badge.textContent = `S${currentSeason} · E${currentEp}`;

    const epCount = (currentItem.episodesPerSeason && currentItem.episodesPerSeason[currentSeason-1]) || 12;
    const totalSeasons = currentItem.seasons || 1;
    
    const prevBtn = document.getElementById('prev-episode-btn');
    const nextBtn = document.getElementById('next-episode-btn');
    if (prevBtn) prevBtn.disabled = (currentSeason === 1 && currentEp === 1);
    if (nextBtn) nextBtn.disabled = (currentSeason === totalSeasons && currentEp === epCount);

    buildSeasonSelect();
    buildEpSelect();
    buildEpisodeQuickList();
}

function buildSeasonSelect() {
    const sel = document.getElementById('player-season-select');
    if (!sel) return;
    sel.innerHTML = '';
    const totalSeasons = currentItem.seasons || 1;
    for (let s = 1; s <= totalSeasons; s++) {
        const o = document.createElement('option');
        o.value = s; o.textContent = `Season ${s}`; o.selected = s === currentSeason;
        sel.appendChild(o);
    }
}

function buildEpSelect() {
    const sel = document.getElementById('player-episode-select');
    if (!sel) return;
    const epCount = (currentItem.episodesPerSeason && currentItem.episodesPerSeason[currentSeason-1]) || 12;
    sel.innerHTML = '';
    for (let e = 1; e <= epCount; e++) {
        const o = document.createElement('option');
        o.value = e; o.textContent = `Episode ${e}`; o.selected = e === currentEp;
        sel.appendChild(o);
    }
}

function buildEpisodeQuickList() {
    const list = document.getElementById('episode-quick-list');
    if (!list || !currentItem) return;

    const epCount = (currentItem.episodesPerSeason && currentItem.episodesPerSeason[currentSeason - 1]) || 12;
    list.innerHTML = '';
    for (let episode = 1; episode <= epCount; episode++) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `episode-chip${episode === currentEp ? ' active' : ''}`;
        button.textContent = String(episode);
        button.setAttribute('aria-label', `Play episode ${episode}`);
        if (episode === currentEp) button.setAttribute('aria-current', 'true');
        button.addEventListener('click', () => selectPlayerEpisode(episode));
        list.appendChild(button);
    }

    const activeButton = list.querySelector('.episode-chip.active');
    if (activeButton) {
        requestAnimationFrame(() => activeButton.scrollIntoView({ block: 'nearest', inline: 'center' }));
    }
}

function selectPlayerEpisode(episode) {
    if (!currentItem || episode === currentEp) return;
    currentEp = episode;
    isStreaming = false;
    updateEpisodeNav();
    loadVideo();
}

function onPlayerSeasonChange() {
    currentSeason = parseInt(document.getElementById('player-season-select').value);
    currentEp = 1;
    isStreaming = false;
    updateEpisodeNav();
    loadVideo();
}

function onPlayerEpisodeChange() {
    currentEp = parseInt(document.getElementById('player-episode-select').value);
    isStreaming = false;
    updateEpisodeNav();
    loadVideo();
}

function nextEpisode() {
    if (!currentItem) return;
    const epCount = (currentItem.episodesPerSeason && currentItem.episodesPerSeason[currentSeason-1]) || 12;
    if (currentEp < epCount) currentEp++;
    else if (currentSeason < currentItem.seasons) { currentSeason++; currentEp = 1; }
    isStreaming = false;
    updateEpisodeNav();
    loadVideo();
}

function prevEpisode() {
    if (!currentItem) return;
    if (currentEp > 1) currentEp--;
    else if (currentSeason > 1) {
        currentSeason--;
        currentEp = (currentItem.episodesPerSeason && currentItem.episodesPerSeason[currentSeason-1]) || 12;
    }
    isStreaming = false;
    updateEpisodeNav();
    loadVideo();
}

document.addEventListener('keydown', event => {
    const player = document.getElementById('player-page');
    const tagName = event.target && event.target.tagName;
    if (!currentItem || !player || player.style.display === 'none' || ['INPUT', 'SELECT', 'TEXTAREA'].includes(tagName)) return;

    if (event.key === 'ArrowRight') {
        event.preventDefault();
        nextEpisode();
    } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        prevEpisode();
    }
});

// ============================================
// Live TMDB Search
// ============================================
// Duplicate handleSearch removed

document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrap')) {
        const r = document.getElementById('search-overlay');
        if (r) r.classList.remove('active');
    }
    if (!e.target.closest('.custom-dropdown')) {
        const drop = document.getElementById('server-dropdown');
        if (drop) drop.classList.remove('open');
    }
});

let _searchTimer = null;
window.handleSearch = function(query) {
    if (_searchTimer) clearTimeout(_searchTimer);
    const overlay = document.getElementById('search-overlay');
    
    if (!query.trim()) {
        overlay.classList.remove('active');
        overlay.innerHTML = '';
        return;
    }
    
    overlay.classList.add('active');
    overlay.innerHTML = '<div style="padding: 20px; text-align: center; color: white;">Searching...</div>';
    
    _searchTimer = setTimeout(async () => {
        try {
            const [tmdbMovies, tmdbShows] = await Promise.all([
                apiFetch(`/search/movie?query=${encodeURIComponent(query.trim())}`),
                apiFetch(`/search/tv?query=${encodeURIComponent(query.trim())}`)
            ]);
            let all = [];
            if(tmdbMovies) all = all.concat(tmdbMovies.map(i => normalizeItem(i, 'movie')));
            if(tmdbShows) all = all.concat(tmdbShows.map(i => normalizeItem(i, 'show')));
            
            if(all.length === 0) {
                overlay.innerHTML = '<div style="padding: 20px; text-align: center; color: white;">No results found.</div>';
                return;
            }
            
            overlay.innerHTML = all.map(item => `
                <div class="search-item" onclick="openPlayerById('${item.id}'); document.getElementById('search-overlay').classList.remove('open'); document.getElementById('search-input').value='';">
                    ${item.poster ? `<img src="${item.poster}" alt="${escapeHtml(item.title)}">` : `<div style="width:50px;height:75px;background:#222;border-radius:4px;"></div>`}
                    <div class="search-item-info">
                        <div class="search-item-title">${escapeHtml(item.title)}</div>
                        <div class="search-item-meta">${item.isAnime?'⚔️ Anime':item.type==='movie'?'🎬 Movie':'📺 Show'} · ${item.year}</div>
                    </div>
                </div>
            `).join('');
        } catch(e) {
            overlay.innerHTML = '<div style="padding: 20px; text-align: center; color: white;">Search failed.</div>';
        }
    }, 400);
};
