const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const {
    buildStreamSources,
    buildFallbackOrder,
    buildCompatibleFallbackOrder,
    isAllowedProviderUrl
} = require('./stream-sources');
const { server } = require('./server');

let baseUrl;

before(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    await new Promise(resolve => server.close(resolve));
});

test('movie sources include an ordered primary and external fallbacks', () => {
    const sources = buildStreamSources({ type: 'movie', id: 550 });
    assert.ok(sources.length >= 2);
    assert.deepEqual(sources.map(source => source.priority), sources.map((_, index) => index + 1));
    assert.equal(new Set(sources.map(source => source.url)).size, sources.length);
    assert.ok(sources.every(source => isAllowedProviderUrl(source.url)));
});

test('TV sources preserve season and episode in every endpoint', () => {
    const sources = buildStreamSources({ type: 'tv', id: 85937, season: 3, episode: 7 });
    assert.ok(sources.length >= 2);
    assert.ok(sources.every(source => source.url.includes('3') && source.url.includes('7')));
});

test('anime falls back to TMDB hosts when AniList mapping is unavailable', () => {
    const sources = buildStreamSources({ type: 'anime', tmdbId: 85937, season: 1, episode: 4 });
    assert.equal(sources.length, 3);
    assert.ok(sources.every(source => source.url.includes('85937')));
});

test('anime catalog includes dedicated hosts and respects dub selection', () => {
    const tmdbFallbacks = buildStreamSources({
        type: 'anime',
        tmdbId: 85937,
        episode: 2,
        audio: 'dub'
    });
    const sources = buildStreamSources({
        type: 'anime',
        tmdbId: 85937,
        anilistId: 113415,
        episode: 2,
        audio: 'dub'
    });
    assert.equal(sources.length, tmdbFallbacks.length + 1);
    assert.match(sources[0].url, /\/113415\/2\/dub$/);
    assert.equal(sources[0].supportsDub, true);
    assert.ok(sources.slice(1).every(source => source.supportsDub === false));
});

test('provider allowlist rejects arbitrary and non-HTTPS health targets', () => {
    assert.equal(isAllowedProviderUrl('http://vidlink.pro/movie/550'), false);
    assert.equal(isAllowedProviderUrl('https://example.com/movie/550'), false);
    assert.equal(isAllowedProviderUrl('https://vidlink.pro.evil.example/movie/550'), false);
});

test('fallback order starts with the selected server and visits every provider once', () => {
    assert.deepEqual(buildFallbackOrder(1, 5), [1, 2, 3, 4, 0]);
    assert.deepEqual(buildFallbackOrder(4, 5), [4, 0, 1, 2, 3]);
    assert.deepEqual(buildFallbackOrder(-1, 5), [4, 0, 1, 2, 3]);
    assert.deepEqual(buildFallbackOrder(0, 0), []);
});

test('dub fallback skips sub-only providers without changing the preferred server', () => {
    const servers = [
        { id: 'dub-one', supportsDub: true },
        { id: 'dub-two', supportsDub: true },
        { id: 'sub-one', supportsDub: false },
        { id: 'sub-two', supportsDub: false }
    ];
    assert.deepEqual(buildCompatibleFallbackOrder(1, servers, true), [1, 0]);
    assert.deepEqual(buildCompatibleFallbackOrder(1, servers, false), [1, 2, 3, 0]);
});

test('streams API exposes primary and fallback endpoints', async () => {
    const response = await fetch(`${baseUrl}/api/streams/tv/85937?season=2&episode=6`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.deepEqual(body.primary, body.sources[0]);
    assert.deepEqual(body.fallbacks, body.sources.slice(1));
    assert.ok(body.sources.length >= 2);
});

test('streams API rejects malformed media identifiers', async () => {
    const response = await fetch(`${baseUrl}/api/streams/movie/not-a-number`);
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.success, false);
});
