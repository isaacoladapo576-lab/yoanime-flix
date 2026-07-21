import { HiAnime } from 'aniwatch';

async function test() {
    try {
        const scraper = new HiAnime.Scraper();
        const search = await scraper.search('Jujutsu Kaisen');
        console.log(JSON.stringify(search, null, 2));
    } catch(e) {
        console.error("HiAnime Failed:", e.message);
    }
}
test();
