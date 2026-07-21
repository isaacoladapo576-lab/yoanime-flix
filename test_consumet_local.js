const { ANIME } = require('@consumet/extensions');

async function test() {
    console.log("Testing Gogoanime...");
    const gogo = new ANIME.Gogoanime();
    try {
        const search = await gogo.search('Jujutsu Kaisen');
        console.log("Search results:", search.results.length);
        const info = await gogo.fetchAnimeInfo(search.results[0].id);
        console.log("Episodes:", info.episodes.length);
        const stream = await gogo.fetchEpisodeSources(info.episodes[0].id);
        console.log("Streams:", stream.sources.length);
        console.log("Working Gogoanime URL:", stream.sources[0].url.substring(0, 50));
    } catch(e) {
        console.error("Gogoanime Failed:", e.message);
    }
}
test();
