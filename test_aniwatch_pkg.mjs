import { HiAnime } from 'aniwatch';

async function test() {
    console.log("Testing HiAnime Scraper...");
    try {
        const scraper = new HiAnime.Scraper();
        const search = await scraper.search('Jujutsu Kaisen');
        console.log("Search results:", search.animes.length);
        const animeId = search.animes[0].id;
        console.log("Anime ID:", animeId);
        const ep = await scraper.getEpisodes(animeId);
        console.log("Episodes:", ep.episodes.length);
        const epId = ep.episodes[0].episodeId;
        const servers = await scraper.getEpisodeServers(animeId, epId);
        console.log("Servers:", servers);
        const streams = await scraper.getEpisodeSources(animeId, epId, "hd-1", "sub");
        console.log("Streams:", streams.sources.length);
        console.log("Working URL:", streams.sources[0].url.substring(0, 50));
    } catch(e) {
        console.error("HiAnime Failed:", e.message);
    }
}
test();
