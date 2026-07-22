'use strict';

const fs = require('fs');
const path = require('path');

const VIDEO_TYPES = Object.freeze({
    '.mp4': 'video/mp4',
    '.m4v': 'video/mp4',
    '.webm': 'video/webm',
    '.ogv': 'video/ogg',
    '.mov': 'video/quicktime',
    '.mkv': 'video/x-matroska'
});

function sendJson(res, status, body) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(body));
}

function normalizeEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;
    const id = String(entry.id || '').trim();
    const file = String(entry.file || '').trim();
    const type = entry.type === 'show' ? 'tv' : String(entry.type || '').toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(id) || !file || !['movie', 'tv', 'anime'].includes(type)) return null;
    return {
        id,
        file,
        type,
        title: String(entry.title || id),
        tmdbId: entry.tmdbId == null ? '' : String(entry.tmdbId),
        anilistId: entry.anilistId == null ? '' : String(entry.anilistId),
        season: Number(entry.season) || 1,
        episode: Number(entry.episode) || 1,
        poster: String(entry.poster || '')
    };
}

function createOwnedMediaLibrary(options = {}) {
    const root = path.resolve(options.root || process.env.OWNED_MEDIA_ROOT || path.join(__dirname, 'owned-media'));
    const manifestPath = path.join(root, 'library.json');

    function resolveFile(entry) {
        const absolute = path.resolve(root, entry.file);
        if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) return null;
        return absolute;
    }

    function readEntries() {
        try {
            const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            const values = Array.isArray(parsed) ? parsed : parsed.items;
            return Array.isArray(values) ? values.map(normalizeEntry).filter(Boolean) : [];
        } catch (_) {
            return [];
        }
    }

    function publicEntry(entry, origin = '') {
        return {
            id: entry.id,
            title: entry.title,
            type: entry.type,
            tmdbId: entry.tmdbId,
            anilistId: entry.anilistId,
            season: entry.season,
            episode: entry.episode,
            poster: entry.poster,
            contentType: VIDEO_TYPES[path.extname(entry.file).toLowerCase()] || 'application/octet-stream',
            streamUrl: `${origin}/owned-media/stream/${encodeURIComponent(entry.id)}`,
            downloadUrl: `${origin}/owned-media/download/${encodeURIComponent(entry.id)}`,
            downloadable: true
        };
    }

    function findMatch(searchParams) {
        const type = searchParams.get('type') === 'show' ? 'tv' : String(searchParams.get('type') || '').toLowerCase();
        const tmdbId = String(searchParams.get('tmdbId') || '');
        const anilistId = String(searchParams.get('anilistId') || '');
        const season = Number(searchParams.get('season')) || 1;
        const episode = Number(searchParams.get('episode')) || 1;
        return readEntries().find(entry => {
            if (entry.type !== type) return false;
            const idMatches = (tmdbId && entry.tmdbId === tmdbId) || (anilistId && entry.anilistId === anilistId);
            if (!idMatches) return false;
            return entry.type === 'movie' || (entry.season === season && entry.episode === episode);
        }) || null;
    }

    function serveFile(req, res, entry, disposition) {
        const absolute = resolveFile(entry);
        if (!absolute) {
            sendJson(res, 403, { success: false, error: 'Invalid media path' });
            return;
        }

        let stat;
        try {
            stat = fs.statSync(absolute);
        } catch (_) {
            sendJson(res, 404, { success: false, error: 'Media file is missing' });
            return;
        }
        if (!stat.isFile()) {
            sendJson(res, 404, { success: false, error: 'Media file is missing' });
            return;
        }

        const contentType = VIDEO_TYPES[path.extname(absolute).toLowerCase()] || 'application/octet-stream';
        const headers = {
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'private, max-age=0, must-revalidate',
            'Access-Control-Allow-Origin': '*',
            'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(path.basename(absolute))}`
        };
        const range = req.headers.range;
        if (range) {
            const match = /^bytes=(\d*)-(\d*)$/.exec(range);
            const start = match && match[1] ? Number(match[1]) : 0;
            const end = match && match[2] ? Number(match[2]) : stat.size - 1;
            if (!match || start < 0 || end < start || end >= stat.size) {
                res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
                res.end();
                return;
            }
            res.writeHead(206, {
                ...headers,
                'Content-Length': String(end - start + 1),
                'Content-Range': `bytes ${start}-${end}/${stat.size}`
            });
            if (req.method === 'HEAD') return res.end();
            fs.createReadStream(absolute, { start, end }).pipe(res);
            return;
        }

        res.writeHead(200, { ...headers, 'Content-Length': String(stat.size) });
        if (req.method === 'HEAD') return res.end();
        fs.createReadStream(absolute).pipe(res);
    }

    async function handle(req, res, urlObj) {
        const pathname = urlObj.pathname;
        if (req.method === 'OPTIONS' && (pathname.startsWith('/api/owned-media') || pathname.startsWith('/owned-media/'))) {
            res.writeHead(204, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                'Access-Control-Allow-Headers': 'Range'
            });
            res.end();
            return true;
        }
        if (!['GET', 'HEAD'].includes(req.method)) return false;

        if (pathname === '/api/owned-media') {
            sendJson(res, 200, { success: true, items: readEntries().map(entry => publicEntry(entry)) });
            return true;
        }
        if (pathname === '/api/owned-media/resolve') {
            const entry = findMatch(urlObj.searchParams);
            if (!entry) sendJson(res, 404, { success: false, error: 'No owned-media file matches this title and episode' });
            else sendJson(res, 200, { success: true, source: publicEntry(entry) });
            return true;
        }

        const match = /^\/owned-media\/(stream|download)\/([a-z0-9][a-z0-9_-]{0,79})$/i.exec(pathname);
        if (!match) return false;
        const entry = readEntries().find(item => item.id === match[2]);
        if (!entry) sendJson(res, 404, { success: false, error: 'Unknown media id' });
        else serveFile(req, res, entry, match[1] === 'download' ? 'attachment' : 'inline');
        return true;
    }

    return Object.freeze({ root, manifestPath, readEntries, findMatch, handle });
}

module.exports = { VIDEO_TYPES, createOwnedMediaLibrary, normalizeEntry };
