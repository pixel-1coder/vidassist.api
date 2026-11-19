# VidAssist API

Universal video/audio downloader API + demo UI. Uses yt-dlp + ffmpeg for most sites, plus a custom Gaana handler.

## Legal

This project is for personal use only. Download only content you own or have permission to download. Respect copyright laws and the terms of service of each platform. DRM-protected content is not supported and must not be circumvented.

## Prerequisites

- Node.js 18 or newer
- yt-dlp on your PATH (or set `YTDLP`)
- ffmpeg on your PATH (or set `FFMPEG`)

## Clone and run

```bash
git clone https://github.com/pixel-1coder/vidassist.api.git
cd vidassist.api
npm install
npm start
```

Open http://localhost:3000

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `YTDLP` | `yt-dlp` | Path to yt-dlp binary |
| `FFMPEG` | `ffmpeg` | Path to ffmpeg binary |

## Notes

- yt-dlp and ffmpeg must be installed and available on PATH.
- DRM-protected services are not supported.
