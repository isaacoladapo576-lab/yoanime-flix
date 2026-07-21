'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
    extractResolvedUrl,
    findAnimePath,
    findSeasonPartPaths,
    findServerLinkId,
    mapEpisodeAcrossParts
} = require('./anichi_scraper');

const searchFixture = `
<a class="aitem" href="/anime/mushoku-season-2-part-2">
  <img alt="Mushoku Tensei: Jobless Reincarnation Season 2 Part 2">
</a>
<a class="aitem" href="/anime/mushoku-base">
  <img alt="Mushoku Tensei: Jobless Reincarnation">
</a>
<a class="aitem" href="/anime/mushoku-season-2">
  <img alt="Mushoku Tensei: Jobless Reincarnation Season 2">
</a>`;

test('AniChi search matching keeps season 1 on the base series', () => {
    assert.equal(
        findAnimePath(searchFixture, 'Mushoku Tensei: Jobless Reincarnation', 1),
        '/anime/mushoku-base'
    );
});

test('AniChi search matching selects the requested later season', () => {
    assert.equal(
        findAnimePath(searchFixture, 'Mushoku Tensei: Jobless Reincarnation Season 2', 2),
        '/anime/mushoku-season-2'
    );
});

test('AniChi search matching discovers split cours in playback order', () => {
    assert.deepEqual(
        findSeasonPartPaths(searchFixture, 'Mushoku Tensei: Jobless Reincarnation Season 2', 2),
        [
            { part: 1, path: '/anime/mushoku-season-2', title: 'Mushoku Tensei: Jobless Reincarnation Season 2' },
            { part: 2, path: '/anime/mushoku-season-2-part-2', title: 'Mushoku Tensei: Jobless Reincarnation Season 2 Part 2' }
        ]
    );
});

test('continuous season episode numbers map across split cours', () => {
    assert.deepEqual(mapEpisodeAcrossParts(12, [12, 12]), { partIndex: 0, episode: 12 });
    assert.deepEqual(mapEpisodeAcrossParts(13, [12, 12]), { partIndex: 1, episode: 1 });
    assert.deepEqual(mapEpisodeAcrossParts(23, [12, 12]), { partIndex: 1, episode: 11 });
    assert.equal(mapEpisodeAcrossParts(25, [12, 12]), null);
});

test('AniChi server parser selects Sub and Dub link ids from their groups', () => {
    const html = `
      <div class="type" data-type="sub"><ul><li data-link-id="sub-link">VidPlay</li></ul></div>
      <div class="type" data-type="dub"><ul><li data-link-id="dub-link">VidPlay</li></ul></div>`;
    assert.equal(findServerLinkId(html, false), 'sub-link');
    assert.equal(findServerLinkId(html, true), 'dub-link');
});

test('AniChi server parser prefers the full HD mirror for dubs', () => {
    const html = `
      <div class="server-items" data-type="dub">
        <button data-link-id="short-preview">VidPlay-1</button>
        <button data-link-id="full-dub">HD-1</button>
        <button data-link-id="alternate-dub">Vidstream-2</button>
      </div>`;
    assert.equal(findServerLinkId(html, true), 'full-dub');
});

test('AniChi URL parser handles nested JSON and iframe HTML', () => {
    assert.equal(
        extractResolvedUrl({ result: '<iframe src="https://video.example/embed/1"></iframe>' }),
        'https://video.example/embed/1'
    );
});
