const fs = require('fs');

async function update() {
    console.log("Reading app.js...");
    let code = fs.readFileSync('app.js', 'utf-8');
    
    // Extract contentDatabase block
    const dbStartMatch = code.match(/const contentDatabase = \[/);
    if (!dbStartMatch) throw new Error("Could not find contentDatabase start");
    
    const startIndex = dbStartMatch.index;
    const arrayStart = startIndex + "const contentDatabase = ".length;
    
    let brackets = 0;
    let endIndex = -1;
    for (let i = arrayStart; i < code.length; i++) {
        if (code[i] === '[') brackets++;
        else if (code[i] === ']') {
            brackets--;
            if (brackets === 0) {
                endIndex = i + 1;
                break;
            }
        }
    }
    
    const dbString = code.substring(arrayStart, endIndex);
    let db;
    eval(`db = ${dbString}`);
    
    console.log(`Found ${db.length} items. Fetching images from TMDB...`);
    
    for (let item of db) {
        if (!item.manualPoster || item.manualPoster.includes('kitsu.app')) {
            // Keep the kitsu ones because they are specific anime ones that might not map well on tmdb
            if (item.id === 'shangri-la-frontier' || item.id === 'solo-leveling') {
                continue;
            }
        }
        
        let url = '';
        if (item.type === 'movie') {
            url = `https://api.themoviedb.org/3/movie/${item.tmdbId}?api_key=15d2ea6d0dc1d476efbca3eba2b9bbfb`;
        } else {
            url = `https://api.themoviedb.org/3/tv/${item.tmdbId}?api_key=15d2ea6d0dc1d476efbca3eba2b9bbfb`;
        }
        
        try {
            const res = await fetch(url);
            const data = await res.json();
            
            if (data.poster_path) {
                item.manualPoster = `https://image.tmdb.org/t/p/w500${data.poster_path}`;
            }
            if (data.backdrop_path) {
                item.manualBackdrop = `https://image.tmdb.org/t/p/w1280${data.backdrop_path}`;
            }
            console.log(`[OK] ${item.title}`);
        } catch(e) {
            console.error(`[FAIL] ${item.title}`, e);
        }
    }
    
    // Format back to JS string
    const newDbString = JSON.stringify(db, null, 4)
        .replace(/"([^"]+)":/g, '$1:') // remove quotes from keys
        .replace(/"/g, "'"); // replace double quotes with single quotes for strings (mostly)
        
    // actually, JSON stringify is fine, but it uses double quotes. 
    // Let's just write a custom stringifier for cleaner code or just use JSON.stringify output directly!
    let finalDbString = JSON.stringify(db, null, 4);
    
    code = code.substring(0, arrayStart) + finalDbString + code.substring(endIndex);
    
    // Remove the old getPoster/getBackdrop fallback block completely
    code = code.replace(/contentDatabase\.forEach\(item => \{[\s\S]*?\}\);/, `contentDatabase.forEach(item => {
    item.poster = item.manualPoster;
    item.backdrop = item.manualBackdrop;
});`);

    fs.writeFileSync('app.js', code);
    console.log("Done!");
}

update();
