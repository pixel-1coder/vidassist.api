# VidAssist API

Universal video/audio downloader API + demo UI. Uses yt-dlp + ffmpeg for most sites, plus a custom Gaana handler.

## Run

```
npm install
npm start
```

Open http://localhost:3000

## Endpoints

- `GET /api/health`
- `POST /api/info` `{ "url": "..." }`
- `GET /api/download?url=...&type=video|audio&title=...`

## Supported

- YouTube / Shorts, TikTok, Instagram Reels (public)
- Gaana
- Hungama, Likee, Amazon MiniTV
- Many others via yt-dlp

## Notes

- yt-dlp and ffmpeg must be available (paths configurable via env `YTDLP`, `FFMPEG`).
- DRM-protected services are not supported.
