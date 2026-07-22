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
    animeTop: [], animeAiring: [],
    showsTop: [], showsAiring: [],
    moviesNow: [], moviesTop: [],
    action: [], comedy: [], horror: [], mylist: [], recent: []
};
const itemRegistry = {};
let currentSection = 'home';

// ============================================
// Init & Fetch Data
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    setupNavbarScroll();
    initAccountSystem();
    loadAllData();
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { closePlayer(); closeModal(); closeAccountPanel(); }
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
    [
        'trending-row', 'anime-row', 'anime-top-row', 'anime-airing-row',
        'shows-row', 'shows-top-row', 'shows-airing-row',
        'movies-row', 'movies-now-row', 'movies-top-row',
        'home-anime-row', 'home-shows-row', 'home-movies-row'
    ].forEach(rowId => renderSkeletons(rowId, 12));

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
    renderRow('home-anime-row', stateCache.anime.slice(0, 24));

    // Fetch the rest silently in the background
    Promise.all([
        fetchMulti('/discover/tv?without_genres=16&sort_by=popularity.desc', 3),
        fetchMulti('/discover/movie?sort_by=popularity.desc', 3),
        fetchMulti('/discover/movie?with_genres=28&sort_by=popularity.desc', 3), // Action
        fetchMulti('/discover/movie?with_genres=35&sort_by=popularity.desc', 3), // Comedy
        fetchMulti('/discover/movie?with_genres=27&sort_by=popularity.desc', 3), // Horror
        fetchMulti('/discover/tv?with_genres=16&with_original_language=ja&sort_by=vote_average.desc&vote_count.gte=200', 2),
        fetchMulti('/discover/tv?with_genres=16&with_original_language=ja&sort_by=first_air_date.desc&vote_count.gte=20', 2),
        fetchMulti('/tv/top_rated?language=en-US', 2),
        fetchMulti('/tv/airing_today?language=en-US', 2),
        fetchMulti('/movie/now_playing?language=en-US', 2),
        fetchMulti('/movie/top_rated?language=en-US', 2)
    ]).then(([showsData, moviesData, actionData, comedyData, horrorData, animeTopData, animeAiringData, showsTopData, showsAiringData, moviesNowData, moviesTopData]) => {
        stateCache.shows = showsData.filter(x => x.poster_path).map(x => normalizeItem(x, 'tv'));
        renderRow('shows-row', stateCache.shows);
        renderRow('home-shows-row', stateCache.shows.slice(0, 24));
        
        stateCache.movies = moviesData.filter(x => x.poster_path).map(x => normalizeItem(x, 'movie'));
        renderRow('movies-row', stateCache.movies);
        renderRow('home-movies-row', stateCache.movies.slice(0, 24));

        stateCache.animeTop = animeTopData.filter(x => x.poster_path).map(x => normalizeItem(x, 'tv'));
        stateCache.animeAiring = animeAiringData.filter(x => x.poster_path).map(x => normalizeItem(x, 'tv'));
        stateCache.showsTop = showsTopData.filter(x => x.poster_path && x.original_language !== 'ja').map(x => normalizeItem(x, 'tv'));
        stateCache.showsAiring = showsAiringData.filter(x => x.poster_path && x.original_language !== 'ja').map(x => normalizeItem(x, 'tv'));
        stateCache.moviesNow = moviesNowData.filter(x => x.poster_path).map(x => normalizeItem(x, 'movie'));
        stateCache.moviesTop = moviesTopData.filter(x => x.poster_path).map(x => normalizeItem(x, 'movie'));
        renderRow('anime-top-row', stateCache.animeTop);
        renderRow('anime-airing-row', stateCache.animeAiring);
        renderRow('shows-top-row', stateCache.showsTop);
        renderRow('shows-airing-row', stateCache.showsAiring);
        renderRow('movies-now-row', stateCache.moviesNow);
        renderRow('movies-top-row', stateCache.moviesTop);
        
        stateCache.action = actionData.filter(x => x.poster_path).map(x => normalizeItem(x, 'movie'));
        renderRow('action-row', stateCache.action);

        stateCache.comedy = comedyData.filter(x => x.poster_path).map(x => normalizeItem(x, 'movie'));
        renderRow('comedy-row', stateCache.comedy);

        stateCache.horror = horrorData.filter(x => x.poster_path).map(x => normalizeItem(x, 'movie'));
        renderRow('horror-row', stateCache.horror);
    });
}

// ============================================
// Local Accounts, My List & Recently Watched
// ============================================
const ACCOUNTS_KEY = 'yoanime_accounts_v1';
const SESSION_KEY = 'yoanime_session_v1';
const GUEST_PROFILE_KEY = 'yoanime_guest_profile_v1';
let currentAccount = null;

function readLocalJson(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key));
        return value == null ? fallback : value;
    } catch (_) {
        return fallback;
    }
}

function profileKey(accountId = currentAccount?.id) {
    return accountId ? `yoanime_profile_${accountId}` : GUEST_PROFILE_KEY;
}

function getProfileData(accountId = currentAccount?.id) {
    const key = profileKey(accountId);
    let data = readLocalJson(key, null);
    if (!data) {
        const legacyBookmarks = accountId ? [] : readLocalJson('yoanime_bookmarks', []);
        data = { bookmarks: legacyBookmarks, recent: [] };
        localStorage.setItem(key, JSON.stringify(data));
    }
    return {
        bookmarks: Array.isArray(data.bookmarks) ? data.bookmarks : [],
        recent: Array.isArray(data.recent) ? data.recent : []
    };
}

function saveProfileData(data, accountId = currentAccount?.id) {
    localStorage.setItem(profileKey(accountId), JSON.stringify({
        bookmarks: Array.isArray(data.bookmarks) ? data.bookmarks : [],
        recent: Array.isArray(data.recent) ? data.recent.slice(0, 30) : []
    }));
}

function initAccountSystem() {
    const sessionId = localStorage.getItem(SESSION_KEY);
    const accounts = readLocalJson(ACCOUNTS_KEY, []);
    currentAccount = accounts.find(account => account.id === sessionId) || null;
    if (!currentAccount) localStorage.removeItem(SESSION_KEY);
    updateAccountUI();
}

function updateAccountUI() {
    const label = document.getElementById('account-label');
    const kicker = document.getElementById('account-kicker');
    const avatar = document.getElementById('account-avatar');
    const mobileLabel = document.getElementById('mobile-account-label');
    const mobileAvatar = document.getElementById('mobile-account-avatar');
    const initial = currentAccount ? currentAccount.name.charAt(0).toUpperCase() : 'Y';
    if (label) label.textContent = currentAccount ? currentAccount.name : 'Sign in';
    if (kicker) kicker.textContent = currentAccount ? 'Watching as' : 'Your profile';
    if (avatar) avatar.textContent = initial;
    if (mobileAvatar) mobileAvatar.textContent = initial;
    if (mobileLabel) mobileLabel.textContent = currentAccount ? currentAccount.name : 'Create account or sign in';

    const libraryTitle = document.getElementById('library-title');
    const librarySubtitle = document.getElementById('library-subtitle');
    if (libraryTitle) libraryTitle.textContent = currentAccount ? `${currentAccount.name}'s Library` : 'My List';
    if (librarySubtitle) librarySubtitle.textContent = currentAccount
        ? 'Your saved titles and watching history, kept separate on this profile.'
        : 'Create a profile to keep your library separate from other viewers on this device.';
}

function loadMyList() {
    const profile = getProfileData();
    stateCache.mylist = profile.bookmarks;
    stateCache.recent = profile.recent.map(entry => ({
        ...entry.item,
        _recentMeta: {
            season: entry.season || 1,
            episode: entry.episode || 1,
            isDub: Boolean(entry.isDub),
            watchedAt: entry.watchedAt || 0
        }
    }));

    [...stateCache.mylist, ...stateCache.recent].forEach(item => { itemRegistry[item.id] = item; });
    renderRow('mylist-row', stateCache.mylist);
    renderRow('recent-row', stateCache.recent, { recent: true });
    renderRow('home-recent-row', stateCache.recent.slice(0, 16), { recent: true });

    const hasSaved = stateCache.mylist.length > 0;
    const hasRecent = stateCache.recent.length > 0;
    const mylistSection = document.getElementById('mylist-section');
    const recentSection = document.getElementById('recent-section');
    const homeRecentSection = document.getElementById('home-recent-section');
    const empty = document.getElementById('library-empty');
    if (mylistSection) mylistSection.style.display = hasSaved ? '' : 'none';
    if (recentSection) recentSection.style.display = hasRecent ? '' : 'none';
    if (homeRecentSection) homeRecentSection.style.display = hasRecent ? '' : 'none';
    if (empty) empty.style.display = hasSaved || hasRecent ? 'none' : 'grid';
    updateAccountUI();
    updateProfilePanel();
}

function toggleBookmarkModal() {
    if (!modalItem) return;
    const profile = getProfileData();
    const index = profile.bookmarks.findIndex(item => String(item.id) === String(modalItem.id));
    const button = document.getElementById('modal-list-btn');
    if (index > -1) {
        profile.bookmarks.splice(index, 1);
        if (button) button.textContent = '+ My List';
        showToast('Removed from My List');
    } else {
        profile.bookmarks.unshift(snapshotItem(modalItem));
        if (button) button.textContent = '✓ In My List';
        showToast('Saved to My List');
    }
    saveProfileData(profile);
    loadMyList();
}

function snapshotItem(item) {
    return {
        id: item.id,
        tmdbId: item.tmdbId,
        type: item.type,
        isAnime: Boolean(item.isAnime),
        title: item.title,
        description: item.description,
        rating: item.rating,
        year: item.year,
        poster: item.poster,
        backdrop: item.backdrop,
        seasons: item.seasons || 1,
        episodesPerSeason: Array.isArray(item.episodesPerSeason) ? item.episodesPerSeason : [],
        imdbId: item.imdbId || null
    };
}

function recordRecentlyWatched() {
    if (!currentItem) return;
    const profile = getProfileData();
    const entry = {
        item: snapshotItem(currentItem),
        season: currentSeason,
        episode: currentEp,
        isDub,
        watchedAt: Date.now()
    };
    profile.recent = profile.recent.filter(saved => String(saved.item?.id) !== String(currentItem.id));
    profile.recent.unshift(entry);
    saveProfileData(profile);
    loadMyList();
}

function openRecentById(id) {
    const item = stateCache.recent.find(entry => String(entry.id) === String(id));
    if (item) openPlayer(item, item._recentMeta);
}

function randomSalt() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password, salt) {
    const bytes = new TextEncoder().encode(`${salt}:${password}`);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}

function switchAuthMode(mode) {
    const isCreate = mode === 'create';
    document.getElementById('signin-form').hidden = isCreate;
    document.getElementById('create-form').hidden = !isCreate;
    document.getElementById('auth-tab-signin').classList.toggle('active', !isCreate);
    document.getElementById('auth-tab-create').classList.toggle('active', isCreate);
    setAuthStatus('');
}

function setAuthStatus(message, isError = false) {
    const status = document.getElementById('auth-status');
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('error', isError);
}

async function handleCreateAccount(event) {
    event.preventDefault();
    const name = document.getElementById('create-name').value.trim();
    const email = document.getElementById('create-email').value.trim().toLowerCase();
    const password = document.getElementById('create-password').value;
    const accounts = readLocalJson(ACCOUNTS_KEY, []);
    if (accounts.some(account => account.email === email)) {
        setAuthStatus('An account with that email already exists.', true);
        return;
    }

    setAuthStatus('Creating your profile…');
    const salt = randomSalt();
    const account = {
        id: `profile_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name,
        email,
        salt,
        passwordHash: await hashPassword(password, salt),
        createdAt: Date.now()
    };
    accounts.push(account);
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));

    const guestProfile = getProfileData(null);
    saveProfileData(guestProfile, account.id);
    currentAccount = account;
    localStorage.setItem(SESSION_KEY, account.id);
    loadMyList();
    openAccountPanel();
    showToast(`Welcome, ${account.name}`);
}

async function handleSignIn(event) {
    event.preventDefault();
    const email = document.getElementById('signin-email').value.trim().toLowerCase();
    const password = document.getElementById('signin-password').value;
    const account = readLocalJson(ACCOUNTS_KEY, []).find(saved => saved.email === email);
    if (!account || await hashPassword(password, account.salt) !== account.passwordHash) {
        setAuthStatus('Email or password is incorrect.', true);
        return;
    }
    currentAccount = account;
    localStorage.setItem(SESSION_KEY, account.id);
    loadMyList();
    openAccountPanel();
    showToast(`Welcome back, ${account.name}`);
}

function signOutAccount() {
    const name = currentAccount?.name;
    currentAccount = null;
    localStorage.removeItem(SESSION_KEY);
    loadMyList();
    closeAccountPanel();
    showToast(name ? `${name} signed out` : 'Signed out');
}

function updateProfilePanel() {
    if (!currentAccount) return;
    const profile = getProfileData();
    const avatar = document.getElementById('profile-hero-avatar');
    if (avatar) avatar.textContent = currentAccount.name.charAt(0).toUpperCase();
    document.getElementById('profile-display-name').textContent = currentAccount.name;
    document.getElementById('profile-email').textContent = currentAccount.email;
    document.getElementById('profile-recent-count').textContent = profile.recent.length;
    document.getElementById('profile-list-count').textContent = profile.bookmarks.length;
}

function openAccountPanel() {
    const modal = document.getElementById('account-modal');
    const guestView = document.getElementById('auth-guest-view');
    const profileView = document.getElementById('auth-profile-view');
    guestView.hidden = Boolean(currentAccount);
    profileView.hidden = !currentAccount;
    if (currentAccount) updateProfilePanel();
    else switchAuthMode('signin');
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeAccountPanel() {
    document.getElementById('account-modal').classList.remove('open');
    if (!document.getElementById('item-modal').classList.contains('open')) document.body.style.overflow = '';
}

let toastTimer = null;
function showToast(message) {
    const toast = document.getElementById('app-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
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
    const validSections = ['home', 'anime', 'shows', 'movies', 'mylist'];
    if (!validSections.includes(section)) section = 'home';
    currentSection = section;

    validSections.forEach(s => {
        const el = document.getElementById(`nav-${s}`);
        if (el) el.classList.toggle('active', s === section);
    });

    document.body.dataset.section = section;
    const hero = document.getElementById('hero-section');
    if (hero) hero.classList.toggle('hero-compact', section !== 'home');
    document.querySelectorAll('.catalogue-view').forEach(view => view.classList.remove('active'));
    const activeView = document.getElementById(`${section}-view`);
    if (activeView) {
        void activeView.offsetWidth;
        activeView.classList.add('active');
    }

    let heroData = [];
    if (section === 'anime') {
        heroData = stateCache.anime.slice(0,6);
    } else if (section === 'shows') {
        heroData = stateCache.shows.slice(0,6);
    } else if (section === 'movies') {
        heroData = stateCache.movies.slice(0,6);
    } else if (section === 'mylist') {
        loadMyList();
        heroData = [...stateCache.recent, ...stateCache.mylist].slice(0,6);
    } else {
        heroData = stateCache.trending.slice(0,6);
    }

    if (heroData.length > 0) initHero(heroData);
    closeMobileMenu();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
function goHome() { showSection('home'); }

// ============================================
// Rendering
// ============================================
function renderRow(rowId, items, options = {}) {
    const row = document.getElementById(rowId);
    if (!row) return;
    row.innerHTML = items.map(item => cardHTML(item, options)).join('');
}

// Show shimmering skeleton placeholders while data loads
function renderSkeletons(rowId, count = 10) {
    const row = document.getElementById(rowId);
    if (!row) return;
    row.innerHTML = Array(count).fill(0).map(() => `
    <div class="card skeleton-card skeleton">
    </div>`).join('');
}

function cardHTML(item, options = {}) {
    const recentMeta = item._recentMeta;
    const isRecent = Boolean(options.recent && recentMeta);
    const action = isRecent ? `openRecentById('${item.id}')` : `openPlayerById('${item.id}')`;
    const typeLabel = item.isAnime ? 'Anime' : item.type === 'movie' ? 'Movie' : 'Series';
    const resumeLabel = isRecent
        ? (item.type === 'movie' ? 'Resume movie' : `Resume S${recentMeta.season} · E${recentMeta.episode}${recentMeta.isDub ? ' · Dub' : ''}`)
        : typeLabel;
    return `
    <button type="button" class="card${isRecent ? ' recent-card' : ''}" onclick="${action}" aria-label="${escapeHtml(resumeLabel)}: ${escapeHtml(item.title)}">
        <span class="card-media">
            ${item.poster
                ? `<img class="card-img" src="${item.poster}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.removeAttribute('src'); this.style.background='#17151f';">`
                : `<span class="card-img card-placeholder">${escapeHtml(item.title)}</span>`
            }
            <span class="card-overlay"><span class="card-play">▶</span></span>
            ${isRecent ? `<span class="resume-pill">S${recentMeta.season} · E${recentMeta.episode}</span>` : ''}
        </span>
        <span class="card-copy">
            <span class="card-title">${escapeHtml(item.title)}</span>
            <span class="card-meta">
                <span>${escapeHtml(resumeLabel)}</span>
                <span class="card-rating">★ ${item.rating}</span>
            </span>
        </span>
    </button>`;
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
        
    // Check bookmark status for the active local profile
    const isBookmarked = getProfileData().bookmarks.some(x => String(x.id) === String(modalItem.id));
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
async function openPlayer(item, resumeState = null) {
    // Ensure we have full details before playing
    if (item.type === 'show' || item.isAnime) {
        item = await fetchFullTVDetails(item);
    }
    
    currentItem   = item;
    const requestedSeason = Number(resumeState?.season) || 1;
    currentSeason = Math.min(Math.max(requestedSeason, 1), item.seasons || 1);
    const episodeCount = (item.episodesPerSeason && item.episodesPerSeason[currentSeason - 1]) || 12;
    currentEp = Math.min(Math.max(Number(resumeState?.episode) || 1, 1), episodeCount);
    isDub = Boolean(resumeState?.isDub);
    serverIndex   = 0;
    // AniChi is season-aware, so prefer it for anime instead of a provider
    // that may reuse the Season 1 catalogue id for later seasons.
    currentServerIndex = item.isAnime ? 1 : 0;
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
            for (let attempt = 0; attempt < 2; attempt++) {
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

                    // Retry transient upstream failures, but not permanent client errors.
                    if (response.status < 500 && response.status !== 429) break;
                } catch (error) {
                    if (error.name === 'AbortError') throw error;
                    lastError = error;
                }

                if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 750));
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
    
    // Resolve the AniList ID again when the season changes. AniList stores
    // seasons as separate catalogue entries, so reusing Season 1's id can
    // return the wrong or truncated video for Season 2+.
    if (currentItem.isAnime && currentItem.anilistSeason !== currentSeason) {
        currentItem.anilistId = null;
        try {
            const query = `query ($search: String) { Media(search: $search, type: ANIME) { id } }`;
            const search = currentSeason > 1
                ? `${currentItem.title} Season ${currentSeason}`
                : currentItem.title;
            const res = await fetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, variables: { search } })
            });
            const data = await res.json();
            currentItem.anilistId = data?.data?.Media?.id;
            currentItem.anilistSeason = currentSeason;
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
    const requiresDub = currentItem.isAnime && isDub;
    const fallbackOrder = window.StreamSources.buildCompatibleFallbackOrder(startIndex, servers, requiresDub);
    let attempts = 0;
    const maxAttempts = fallbackOrder.length;

    function handleServerFailure(srv, message) {
        console.warn(`[Player] ${srv.name} failed: ${message}. Trying the next server.`);
        tryServer();
    }

    async function tryServer() {
        if (loadId !== playbackLoadId || !currentItem) return;
        if (attempts >= maxAttempts) {
            showPlayerError(requiresDub
                ? 'All dub-capable servers failed. Please try Sub or try again later.'
                : 'All servers failed. Please try again later.');
            return;
        }
        currentServerIndex = fallbackOrder[attempts];
        attempts++;
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
                recordRecentlyWatched();
                console.log(`[Player] ✓ ${srv.name} loaded successfully`);
            };

            iframe.src = embedUrl;

        } catch (err) {
            if (loadId !== playbackLoadId) return;
            console.warn(`[Player] ${srv.name} threw: ${err.message}, trying next…`);
            handleServerFailure(srv, err.message);
        }
    }

    tryServer();
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
                recordRecentlyWatched();
                video.play();
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = url;
            loading.classList.add('hidden');
            isStreaming = true;
            recordRecentlyWatched();
        }
    } else {
        video.src = url;
        video.oncanplay = () => { loading.classList.add('hidden'); isStreaming = true; recordRecentlyWatched(); };
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
    }

    if (!Number.isInteger(currentServerIndex) || currentServerIndex < 0 || currentServerIndex >= servers.length) {
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
                <div class="search-item" onclick="openPlayerById('${item.id}'); document.getElementById('search-overlay').classList.remove('active'); document.getElementById('search-input').value='';">
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
