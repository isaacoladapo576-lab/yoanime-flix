const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');
const { createOwnedMediaLibrary, normalizeEntry } = require('./owned-media');

let root;
let server;
let baseUrl;

before(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'yoanime-owned-media-'));
    fs.writeFileSync(path.join(root, 'movie.mp4'), Buffer.from('0123456789abcdef'));
    fs.writeFileSync(path.join(root, 'episode.webm'), Buffer.from('episode-bytes'));
    fs.writeFileSync(path.join(root, 'library.json'), JSON.stringify({
        items: [
            { id: 'movie-one', type: 'movie', title: 'Movie One', tmdbId: '100', file: 'movie.mp4' },
            { id: 'anime-one', type: 'anime', title: 'Anime One', tmdbId: '200', anilistId: '300', season: 1, episode: 2, file: 'episode.webm' },
            { id: 'unsafe', type: 'movie', title: 'Unsafe', tmdbId: '999', file: '../outside.mp4' }
        ]
    }));

    const library = createOwnedMediaLibrary({ root });
    server = http.createServer(async (req, res) => {
        const handled = await library.handle(req, res, new URL(req.url, 'http://localhost'));
        if (!handled) {
            res.writeHead(404);
            res.end();
        }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
});

test('normalizes only supported media records', () => {
    assert.equal(normalizeEntry({ id: 'ok', type: 'show', file: 'episode.mp4' }).type, 'tv');
    assert.equal(normalizeEntry({ id: '../bad', type: 'movie', file: 'movie.mp4' }), null);
    assert.equal(normalizeEntry({ id: 'bad', type: 'audio', file: 'song.mp3' }), null);
});

test('resolves movies and anime episodes to downloadable sources', async () => {
    const movieResponse = await fetch(`${baseUrl}/api/owned-media/resolve?type=movie&tmdbId=100`);
    const movie = await movieResponse.json();
    assert.equal(movieResponse.status, 200);
    assert.equal(movie.source.downloadable, true);
    assert.equal(movie.source.contentType, 'video/mp4');

    const animeResponse = await fetch(`${baseUrl}/api/owned-media/resolve?type=anime&anilistId=300&season=1&episode=2`);
    const anime = await animeResponse.json();
    assert.equal(animeResponse.status, 200);
    assert.equal(anime.source.id, 'anime-one');
    assert.equal(anime.source.contentType, 'video/webm');
});

test('serves browser downloads and byte ranges', async () => {
    const download = await fetch(`${baseUrl}/owned-media/download/movie-one`);
    assert.equal(download.status, 200);
    assert.match(download.headers.get('content-disposition'), /^attachment;/);
    assert.equal(await download.text(), '0123456789abcdef');

    const range = await fetch(`${baseUrl}/owned-media/stream/movie-one`, { headers: { Range: 'bytes=4-7' } });
    assert.equal(range.status, 206);
    assert.equal(range.headers.get('content-range'), 'bytes 4-7/16');
    assert.equal(await range.text(), '4567');
});

test('blocks files outside the configured media root', async () => {
    const response = await fetch(`${baseUrl}/owned-media/download/unsafe`);
    const body = await response.json();
    assert.equal(response.status, 403);
    assert.equal(body.success, false);
});
