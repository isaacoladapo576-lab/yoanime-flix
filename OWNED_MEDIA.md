# Owned media server

This server streams and downloads video files you own or are licensed to distribute. It supports movies, TV episodes, and anime episodes without extracting files from protected third-party players.

## Add media

1. Create `owned-media/library.json` by copying `owned-media/library.example.json`.
2. Put each video file in the `owned-media` folder (or set `OWNED_MEDIA_ROOT` to another folder).
3. Set each entry's TMDB ID. Anime entries may additionally use an AniList ID.
4. Restart the server.

The website checks this library before its embedded providers. A matching entry appears as **My downloadable media**, plays through the native player, and enables **Save + Download**. The same click saves the file in the browser's Downloads folder and the site's offline library.

## Persistent hosting

For a hosted deployment, mount persistent storage and set `OWNED_MEDIA_ROOT` to that mount path. Keep `library.json` and the video files inside that directory. Render's normal application filesystem may be replaced during deployment, so do not rely on it for your media library.

## Endpoints

- `GET /api/owned-media` — list configured items.
- `GET /api/owned-media/resolve?...` — resolve a title/episode.
- `GET /owned-media/stream/:id` — stream with HTTP range support.
- `GET /owned-media/download/:id` — download with attachment headers.

Only `GET`, `HEAD`, and CORS preflight requests are accepted. Paths are resolved inside the configured media root to prevent directory traversal.
