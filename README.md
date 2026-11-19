# VidAssist API

Universal video/audio downloader API + demo UI. Uses yt-dlp + ffmpeg for most sites, plus a custom Gaana handler.

## Legal

This project is for personal use only. Download only content you own or have permission to download. Respect copyright laws and the terms of service of each platform. DRM-protected content is not supported and must not be circumvented.

## Setup

Everything is installed by npm. No separate downloads needed.

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
| `YTDLP` | bundled | Path to yt-dlp binary |
| `FFMPEG` | bundled | Path to ffmpeg binary |

## Notes

- yt-dlp and ffmpeg binaries are bundled with npm install.
- DRM-protected services are not supported.
- Temporary video files are written to the OS temp dir and deleted after streaming.
