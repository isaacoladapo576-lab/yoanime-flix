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

function getCurrentStreamServers() {
    if (!window.StreamSources) return [];
    const type = currentItem.isAnime ? 'anime' : currentItem.type;
    return window.StreamSources.buildStreamSources({
        type,
        title: currentItem.title,
        tmdbId: currentItem.tmdbId,
        anilistId: currentItem.anilistId,
        season: currentSeason,
        episode: currentEp,
        audio: isDub ? 'dub' : 'sub'
    }).map(source => ({ ...source, url: () => source.url }));
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
    let attempts = 0;
    const maxAttempts = servers.length;

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
                const result = await srv.url(currentItem, currentSeason, currentEp);
                if (result.iframe === false) {
                    playRawStream(result.url, result.type || 'mp4');
                    return;
                }
                embedUrl = result.url;
            } else if (srv.iframe === false) {
                const result = await srv.url(currentItem, currentSeason, currentEp);
                playRawStream(result.rawUrl, result.type);
                return;
            } else {
                embedUrl = srv.url(currentItem, currentSeason, currentEp);
            }

            console.log(`[Player] Attempt ${attempts}: ${srv.name} → ${embedUrl}`);

            const endpointOnline = await checkStreamEndpoint(embedUrl);
            if (loadId !== playbackLoadId) return;
            if (endpointOnline === false) {
                console.warn(`[Player] ${srv.name} is offline, trying next server`);
                tryServer(currentServerIndex + 1);
                return;
            }

            // Clear previous handlers
            iframe.onload = null;
            iframe.onerror = null;

            let settled = false;
            const fallbackTimeout = setTimeout(() => {
                if (loadId === playbackLoadId && !settled && !isStreaming) {
                    settled = true;
                    console.warn(`[Player] ${srv.name} timed out after 30s, trying next…`);
                    tryServer(currentServerIndex + 1);
                }
            }, 30000);

            iframe.onerror = () => {
                if (loadId !== playbackLoadId || settled) return;
                settled = true;
                clearTimeout(fallbackTimeout);
                console.warn(`[Player] ${srv.name} errored, trying next…`);
                tryServer(currentServerIndex + 1);
            };

            iframe.onload = () => {
                if (loadId !== playbackLoadId || settled) return;
                settled = true;
                clearTimeout(fallbackTimeout);
                loading.classList.add('hidden');
                iframe.style.display = 'block';
                isStreaming = true;
                console.log(`[Player] ✓ ${srv.name} loaded successfully`);
            };

            iframe.src = embedUrl;

        } catch (err) {
            if (loadId !== playbackLoadId) return;
            console.warn(`[Player] ${srv.name} threw: ${err.message}, trying next…`);
            tryServer(currentServerIndex + 1);
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
    const sw = document.getElementById('server-switcher');
    const sel = document.getElementById('server-select');
    if (!sw || !sel) return;

    sw.style.display = 'block';
    
    // Only rebuild if the options don't match the list size
    if (sel.options.length !== servers.length) {
        sel.innerHTML = '';
        servers.forEach((s, i) => {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = s.name;
            sel.appendChild(opt);
        });
        currentServerIndex = 0;
    }
    sel.value = currentServerIndex;

    // Show Sub/Dub toggle for anime (only if server supports it)
    const dubToggle = document.getElementById('dub-toggle');
    if (dubToggle) {
        if (!currentItem.isAnime) {
            dubToggle.style.display = 'none';
        } else {
            const srv = servers[currentServerIndex];
            dubToggle.style.display = 'flex';
            if (srv && srv.supportsDub) {
                document.getElementById('btn-sub').style.display = '';
                document.getElementById('btn-dub').style.display = '';
                document.getElementById('btn-sub').classList.toggle('active', !isDub);
                document.getElementById('btn-dub').classList.toggle('active', isDub);
                // Remove sub-only label if present
                const lbl = document.getElementById('sub-only-label');
                if (lbl) lbl.remove();
            } else {
                // Hide dub button, show 'Sub Only' label
                document.getElementById('btn-sub').style.display = 'none';
                document.getElementById('btn-dub').style.display = 'none';
                if (!document.getElementById('sub-only-label')) {
                    const lbl = document.createElement('span');
                    lbl.id = 'sub-only-label';
                    lbl.textContent = 'Sub Only';
                    lbl.style.cssText = 'color:#9898b0;font-size:0.85rem;padding:4px 12px;background:rgba(255,255,255,0.05);border-radius:6px;';
                    dubToggle.appendChild(lbl);
                }
            }
        }
    }
}



window.setDub = function(dub) {
    isDub = dub;
    document.getElementById('btn-sub').classList.toggle('active', !dub);
    document.getElementById('btn-dub').classList.toggle('active', dub);
    loadVideo();
};

window.changeServer = function(index) {
    currentServerIndex = parseInt(index);
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

// ============================================
// Live TMDB Search
// ============================================
let searchTimeout = null;

async function handleSearch(val) {
    clearTimeout(searchTimeout);
    const clear   = document.getElementById('search-clear');
    const results = document.getElementById('search-results');
    clear.style.display = val ? 'block' : 'none';
    if (!val.trim()) { results.classList.remove('open'); results.innerHTML = ''; return; }

    searchTimeout = setTimeout(async () => {
        results.innerHTML = '<div class="search-no-results">Searching...</div>';
        results.classList.add('open');
        
        const q = encodeURIComponent(val.trim());
        const data = await apiFetch(`/search/multi?query=${q}`);
        
        // Filter out people, keep movies/tv, ensure they have images
        const found = data.filter(x => (x.media_type === 'movie' || x.media_type === 'tv') && x.poster_path)
                          .map(x => normalizeItem(x))
                          .slice(0, 20); // Show up to 20 results for scrolling

        results.innerHTML = found.length === 0
            ? '<div class="search-no-results">No results found</div>'
            : found.map(item => `
                <div class="search-result-item" onclick="openPlayerById('${item.id}'); clearSearch();">
                    ${item.poster
                        ? `<img class="search-thumb" src="${item.poster}" alt="${escapeHtml(item.title)}" onerror="this.style.display='none'">`
                        : ''}
                    <div class="search-info">
                        <div class="s-title">${escapeHtml(item.title)}</div>
                        <div class="s-meta">${item.isAnime?'⚔️ Anime':item.type==='movie'?'🎬 Movie':'📺 Show'} · ${item.year}</div>
                    </div>
                </div>`).join('');
    }, 500);
}

function clearSearch() {
    const input = document.getElementById('search-input');
    const clear = document.getElementById('search-clear');
    const res   = document.getElementById('search-results');
    input.value = '';
    clear.style.display = 'none';
    res.classList.remove('open');
    res.innerHTML = '';
}

document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrap')) {
        const r = document.getElementById('search-results');
        if (r) r.classList.remove('open');
    }
});

window.searchContent = async function(query = null) {
    const q = query || document.getElementById('search-input').value.trim();
    if(!q) return;
    showSection('search');
    const resultsGrid = document.getElementById('search-results');
    resultsGrid.style.display = 'grid';
    resultsGrid.innerHTML = '<div style="grid-column: 1/-1;text-align:center;padding:50px;color:white;">Searching...</div>';
    try {
        const [tmdbMovies, tmdbShows] = await Promise.all([
            apiFetch(`/search/movie?query=${encodeURIComponent(q)}`),
            apiFetch(`/search/tv?query=${encodeURIComponent(q)}`)
        ]);
        let all = [];
        if(tmdbMovies) all = all.concat(tmdbMovies.map(i => normalizeItem(i, 'movie')));
        if(tmdbShows) all = all.concat(tmdbShows.map(i => normalizeItem(i, 'show')));
        if(all.length === 0) {
            resultsGrid.innerHTML = '<div style="grid-column: 1/-1;text-align:center;padding:50px;color:white;">No results found.</div>';
            return;
        }
        resultsGrid.innerHTML = all.map(cardHTML).join('');
    } catch(e) {
        resultsGrid.innerHTML = '<div style="grid-column: 1/-1;text-align:center;padding:50px;color:white;">Search failed.</div>';
    }
};
