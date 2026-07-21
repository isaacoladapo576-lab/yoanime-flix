'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { extractResolvedUrl, findAnimePath, findServerLinkId } = require('./anichi_scraper');

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

test('AniChi server parser selects Sub and Dub link ids from their groups', () => {
    const html = `
      <div class="type" data-type="sub"><ul><li data-link-id="sub-link">VidPlay</li></ul></div>
      <div class="type" data-type="dub"><ul><li data-link-id="dub-link">VidPlay</li></ul></div>`;
    assert.equal(findServerLinkId(html, false), 'sub-link');
    assert.equal(findServerLinkId(html, true), 'dub-link');
});

test('AniChi URL parser handles nested JSON and iframe HTML', () => {
    assert.equal(
        extractResolvedUrl({ result: '<iframe src="https://video.example/embed/1"></iframe>' }),
        'https://video.example/embed/1'
    );
});
