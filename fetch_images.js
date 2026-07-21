// Fetch verified TMDB images for all content
const https = require('https');
const TMDB_KEY = '15d2ea6d0dc1d476efbca3eba2b9bbfb';

const items = [
    // ANIME (TMDB TV IDs)
    { id: 'shangri-la-frontier',    type: 'tv',    tmdbId: 211089 },
    { id: 'solo-leveling',          type: 'tv',    tmdbId: 205040 },
    { id: 'attack-on-titan',        type: 'tv',    tmdbId: 1429   },
    { id: 'demon-slayer',           type: 'tv',    tmdbId: 85937  },
    { id: 'fullmetal-alchemist',    type: 'tv',    tmdbId: 31911  },
    { id: 'death-note',             type: 'tv',    tmdbId: 13916  },
    { id: 'one-piece',              type: 'tv',    tmdbId: 37854  },
    { id: 'naruto',                 type: 'tv',    tmdbId: 31910  },
    { id: 'jjk',                    type: 'tv',    tmdbId: 95479  },
    { id: 'chainsaw-man',           type: 'tv',    tmdbId: 114410 },
    { id: 'vinland-saga',           type: 'tv',    tmdbId: 91633  },
    { id: 'oshi-no-ko',             type: 'tv',    tmdbId: 209867 },
    { id: 'bleach-tybw',            type: 'tv',    tmdbId: 139164 },
    // SHOWS
    { id: 'breaking-bad',           type: 'tv',    tmdbId: 1396   },
    { id: 'stranger-things',        type: 'tv',    tmdbId: 66732  },
    { id: 'the-office',             type: 'tv',    tmdbId: 2316   },
    { id: 'game-of-thrones',        type: 'tv',    tmdbId: 1399   },
    { id: 'the-boys',               type: 'tv',    tmdbId: 76479  },
    { id: 'rick-and-morty',         type: 'tv',    tmdbId: 60625  },
    { id: 'house-of-the-dragon',    type: 'tv',    tmdbId: 94997  },
    { id: 'peaky-blinders',         type: 'tv',    tmdbId: 46648  },
    { id: 'fallout',                type: 'tv',    tmdbId: 113988 },
    { id: 'two-and-a-half-men',     type: 'tv',    tmdbId: 2691   },
    // MOVIES
    { id: 'the-dark-knight',        type: 'movie', tmdbId: 155    },
    { id: 'interstellar',           type: 'movie', tmdbId: 157336 },
    { id: 'oppenheimer',            type: 'movie', tmdbId: 872585 },
    { id: 'dune-part-two',          type: 'movie', tmdbId: 693134 },
    { id: 'deadpool-wolverine',     type: 'movie', tmdbId: 533535 },
    { id: 'john-wick-4',            type: 'movie', tmdbId: 603692 },
    { id: 'spiderman-across',       type: 'movie', tmdbId: 569094 },
    { id: 'avatar-way',             type: 'movie', tmdbId: 76600  },
];

function get(url) {
    return new Promise((resolve, reject) => {
        https.get(url, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => resolve(JSON.parse(d)));
        }).on('error', reject);
    });
}

async function main() {
    const results = {};
    for (const item of items) {
        const url = `https://api.themoviedb.org/3/${item.type}/${item.tmdbId}?api_key=${TMDB_KEY}`;
        const data = await get(url);
        results[item.id] = {
            poster:   data.poster_path   ? `https://image.tmdb.org/t/p/w500${data.poster_path}`   : null,
            backdrop: data.backdrop_path ? `https://image.tmdb.org/t/p/w1280${data.backdrop_path}` : null
        };
        process.stdout.write(`[${data.poster_path ? 'OK' : 'MISSING'}] ${item.id}\n`);
    }
    require('fs').writeFileSync('images.json', JSON.stringify(results, null, 2));
    console.log('\nDone! images.json written.');
}

main().catch(console.error);
