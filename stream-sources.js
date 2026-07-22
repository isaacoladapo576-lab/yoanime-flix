(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.StreamSources = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const PROVIDER_HOSTS = Object.freeze([
        'tryembed.us.cc',
        'vidsrc.pm',
        'autoembed.co',
        'vidsrc.in',
        'cinevaro.app',
        'embed.smashystream.com',
        'vidsrc.me',
        'multiembed.mov',
        'vidlink.pro',
        'vidtube.site',
        'dulo.tv',
        'mediacache.cc'
    ]);

    function positiveInteger(value, fallback) {
        const number = Number(value);
        return Number.isInteger(number) && number > 0 ? number : fallback;
    }

    function cleanId(value) {
        const id = String(value == null ? '' : value).trim();
        return /^\d+$/.test(id) ? id : '';
    }

    function buildStreamSources(options) {
        const input = options || {};
        const type = input.type === 'show' ? 'tv' : String(input.type || '').toLowerCase();
        const tmdbId = cleanId(input.tmdbId || (type !== 'anime' ? input.id : ''));
        const anilistId = cleanId(input.anilistId || (type === 'anime' ? input.id : ''));
        const season = positiveInteger(input.season, 1);
        const episode = positiveInteger(input.episode, 1);
        const audio = input.audio === 'dub' ? 'dub' : 'sub';
        let sources = [];

        if (type === 'anime') {
            if (anilistId) {
                sources.push(
                    {
                        id: 'tryembed',
                        name: 'Server 1 (Fast)',
                        url: `https://tryembed.us.cc/embed/anime/${anilistId}/${episode}/${audio}`,
                        supportsDub: true
                    }
                );
            }
            if (tmdbId) {
                sources.push(
                    {
                        id: 'autoembed',
                        name: 'Server 2 (AutoEmbed)',
                        url: `https://autoembed.co/tv/tmdb/${tmdbId}-${season}-${episode}`,
                        supportsDub: false
                    },
                    {
                        id: 'vidsrc-in',
                        name: 'Server 3 (VidSrc)',
                        url: `https://vidsrc.in/embed/tv/${tmdbId}/${season}/${episode}`,
                        supportsDub: false
                    },
                    {
                        id: 'vidlink-anime',
                        name: 'Server 4 (Backup)',
                        url: `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}`,
                        supportsDub: false
                    }
                );
            }
        } else if (type === 'movie' && tmdbId) {
            sources = [
                { id: 'cinevaro', name: 'Server 1 (HD)', url: `https://cinevaro.app/embed/movie/${tmdbId}` },
                { id: 'smashystream', name: 'Server 2 (HD)', url: `https://embed.smashystream.com/playere.php?tmdb=${tmdbId}` },
                { id: 'vidsrc-me', name: 'Server 3 (Backup)', url: `https://vidsrc.me/embed/movie?tmdb=${tmdbId}` },
                { id: 'vidlink', name: 'Server 4 (Backup)', url: `https://vidlink.pro/movie/${tmdbId}` }
            ];
        } else if (type === 'tv' && tmdbId) {
            sources = [
                { id: 'cinevaro', name: 'Server 1 (HD)', url: `https://cinevaro.app/embed/tv/${tmdbId}/${season}/${episode}` },
                { id: 'smashystream', name: 'Server 2 (HD)', url: `https://embed.smashystream.com/playere.php?tmdb=${tmdbId}&s=${season}&e=${episode}` },
                { id: 'vidsrc-me', name: 'Server 3 (Backup)', url: `https://vidsrc.me/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}` },
                { id: 'vidlink', name: 'Server 4 (Backup)', url: `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}` }
            ];
        }

        return sources.map((source, index) => Object.freeze({
            ...source,
            priority: index + 1,
            iframe: true,
            downloadable: false,
            supportsDub: Boolean(source.supportsDub)
        }));
    }

    function isAllowedProviderUrl(value) {
        try {
            const url = new URL(value);
            return url.protocol === 'https:' && PROVIDER_HOSTS.includes(url.hostname.toLowerCase());
        } catch (_) {
            return false;
        }
    }

    function buildFallbackOrder(startIndex, serverCount) {
        const count = Number(serverCount);
        if (!Number.isInteger(count) || count <= 0) return [];

        const requestedStart = Number(startIndex);
        const normalizedStart = Number.isInteger(requestedStart)
            ? ((requestedStart % count) + count) % count
            : 0;

        return Array.from({ length: count }, (_, offset) => (normalizedStart + offset) % count);
    }

    function buildCompatibleFallbackOrder(startIndex, servers, requireDub = false) {
        if (!Array.isArray(servers)) return [];
        const order = buildFallbackOrder(startIndex, servers.length);
        return requireDub ? order.filter(index => servers[index]?.supportsDub === true) : order;
    }

    return Object.freeze({
        PROVIDER_HOSTS,
        buildStreamSources,
        buildFallbackOrder,
        buildCompatibleFallbackOrder,
        isAllowedProviderUrl
    });
});
