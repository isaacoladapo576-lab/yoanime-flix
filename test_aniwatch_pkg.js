const { Aniwatch } = require('aniwatch');

async function test() {
    console.log("Testing Aniwatch npm package...");
    try {
        const aniwatch = new Aniwatch();
        const search = await aniwatch.search('Jujutsu Kaisen');
        console.log("Search results:", search.animes.length);
        const ep = await aniwatch.getEpisodes(search.animes[0].id);
        console.log("Episodes:", ep.episodes.length);
        const servers = await aniwatch.getEpisodeServers(ep.episodes[0].id);
        console.log("Servers:", servers.sub.length);
        const streams = await aniwatch.getEpisodeSources(ep.episodes[0].id);
        console.log("Streams:", streams.sources.length);
        console.log("Working URL:", streams.sources[0].url.substring(0, 50));
    } catch(e) {
        console.error("Aniwatch Failed:", e.message);
    }
}
test();
