const { ANIME } = require('@consumet/extensions');

async function test() {
    console.log("Testing Hianime...");
    const hi = new ANIME.Hianime();
    try {
        const search = await hi.search('Jujutsu Kaisen');
        console.log("Search results:", search.results.length);
        const info = await hi.fetchAnimeInfo(search.results[0].id);
        console.log("Episodes:", info.episodes.length);
        const stream = await hi.fetchEpisodeSources(info.episodes[0].id);
        console.log("Streams:", stream.sources.length);
        console.log("Working URL:", stream.sources[0].url.substring(0, 50));
    } catch(e) {
        console.error("Hianime Failed:", e.message);
    }
}
test();
