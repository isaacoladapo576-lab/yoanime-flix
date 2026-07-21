import pkg from '@consumet/extensions';
const { ANIME } = pkg;

async function testHianime() {
    console.log("Testing Hianime Scraper...");
    const hianime = new ANIME.Hianime();
    
    try {
        console.log("Searching for 'Jujutsu Kaisen'...");
        const searchResults = await hianime.search("Jujutsu Kaisen");
        console.log(`Found ${searchResults.results.length} results. First result: ${searchResults.results[0].id}`);
        
        const animeId = searchResults.results[0].id;
        
        console.log(`\nFetching info for ${animeId}...`);
        const animeInfo = await hianime.fetchAnimeInfo(animeId);
        console.log(`Found ${animeInfo.episodes.length} episodes. First episode ID: ${animeInfo.episodes[0].id}`);
        
        const episodeId = animeInfo.episodes[0].id;
        
        console.log(`\nFetching streaming links for ${episodeId}...`);
        const sources = await hianime.fetchEpisodeSources(episodeId);
        console.log("Stream sources:");
        sources.sources.forEach(s => console.log(`[${s.quality}] ${s.url}`));
        
    } catch(err) {
        console.error("Error:", err);
    }
}
testHianime();
