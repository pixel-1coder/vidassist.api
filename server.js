const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const YTDLP = process.env.YTDLP || 'C:\\Users\\Lenovo\\AppData\\Local\\Programs\\Python\\Python312\\Scripts\\yt-dlp.exe';
const FFMPEG = process.env.FFMPEG || 'C:\\Users\\Lenovo\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.2-full_build\\bin\\ffmpeg.exe';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const titleCache = new Map();

function safeName(name) {
  return (name || '').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, ' ').slice(0, 80) || 'download';
}

function isGaana(url) { return /gaana\.com/i.test(url); }

function decryptGaana(msg) {
  const t = parseInt(msg.substring(0, 1), 10);
  if (isNaN(t)) throw new Error('bad gaana msg');
  const ivStr = msg.substring(t, t + 16);
  const ctB64 = msg.substring(t + 16);
  const key = Buffer.from('Z3kxdCNiQGpsKGIkd3RtZQ==', 'base64');
  const iv = Buffer.from(ivStr, 'utf8');
  const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
  decipher.setAutoPadding(true);
  return decipher.update(ctB64, 'base64', 'utf8') + decipher.final('utf8');
}

async function getGaanaData(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error('gaana fetch failed ' + r.status);
  const html = await r.text();
  const m = html.match(/<script id="preloaded-state"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no preloaded state');
  const state = JSON.parse(m[1]);
  const track = state && state.song && state.song.songDetail && state.song.songDetail.tracks && state.song.songDetail.tracks[0];
  if (!track) throw new Error('no track');
  const urls = track.urls || {};
  const pick = urls.high || urls.medium || urls.auto || urls.normal;
  if (!pick || !pick.message) throw new Error('no stream message');
  const streamUrl = decryptGaana(pick.message);
  return { track, streamUrl };
}

app.get('/api/health', (req, res) => res.json({ ok: true, ytdlp: YTDLP }));

// Metadata (fast, no download)
app.post('/api/info', async (req, res) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'url required' });

  if (isGaana(url)) {
    try {
      const { track, streamUrl } = await getGaanaData(url);
      titleCache.set(url, track.track_title);
      return res.json({
        title: track.track_title,
        uploader: (track.artist && track.artist.map(a => a.name).join(', ')) || track.album_title,
        duration: parseInt(track.duration, 10) || 0,
        thumbnail: track.artwork_web || track.artwork,
        webpage_url: url,
        extractor: 'Gaana',
        formats: [{ id: 'high', ext: 'm4a', quality: (track.urls && track.urls.high && track.urls.high.bitRate) || '128', filesize: null, vcodec: 'none', acodec: 'aac', url: streamUrl }]
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  const args = ['--dump-json', '--no-playlist', '--no-warnings', url];
  const p = spawn(YTDLP, args, { windowsHide: true });
  let out = '', err = '';
  p.stdout.on('data', d => out += d);
  p.stderr.on('data', d => err += d);
  p.on('close', code => {
    if (code !== 0) return res.status(500).json({ error: err || 'yt-dlp failed' });
    try {
      const j = JSON.parse(out);
      titleCache.set(url, j.title);
      res.json({
        title: j.title,
        uploader: j.uploader || j.channel,
        duration: j.duration,
        thumbnail: j.thumbnail,
        webpage_url: j.webpage_url,
        extractor: j.extractor_key,
        formats: (j.formats || []).filter(f => f.url).map(f => ({
          id: f.format_id,
          ext: f.ext,
          quality: f.format_note || f.resolution || f.abr,
          filesize: f.filesize || f.filesize_approx,
          vcodec: f.vcodec,
          acodec: f.acodec,
          url: f.url
        }))
      });
    } catch (e) {
      res.status(500).json({ error: 'parse failed', raw: out.slice(0, 500) });
    }
  });
});

// Stream download (video or audio)
app.get('/api/download', async (req, res) => {
  const { url, type = 'video', quality, title } = req.query;
  if (!url) return res.status(400).send('url required');
  const isAudio = type === 'audio';
  const resolvedTitle = title || titleCache.get(url) || '';

  if (isGaana(url)) {
    let streamUrl, track;
    try { ({ track, streamUrl } = await getGaanaData(url)); }
    catch (e) { return res.status(500).send(e.message); }
    titleCache.set(url, track.track_title);
    const filename = safeName(track.track_title) + '.mp3';
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'audio/mpeg');
    const args = ['-y', '-i', streamUrl, '-vn', '-acodec', 'libmp3lame', '-q:a', '2', '-f', 'mp3', '-'];
    const p = spawn(FFMPEG, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    p.stdout.pipe(res);
    let err = '';
    p.stderr.on('data', d => err += d);
    p.on('close', code => { if (code !== 0 && !res.headersSent) res.status(500).send(err.slice(-500)); });
    req.on('close', () => { try { p.kill(); } catch {} });
    return;
  }

  if (isAudio) {
    const args = ['--no-playlist', '--no-warnings', '-q', '-f', 'bestaudio/best', '-x', '--audio-format', 'mp3', '--audio-quality', '0', '--ffmpeg-location', path.dirname(FFMPEG), '-o', '-', url];
    const p = spawn(YTDLP, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const filename = safeName(resolvedTitle) + '.mp3';
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'audio/mpeg');
    p.stdout.pipe(res);
    let err = '';
    p.stderr.on('data', d => err += d);
    p.on('close', code => { if (code !== 0 && !res.headersSent) res.status(500).send(err); });
    req.on('close', () => { try { p.kill(); } catch {} });
    return;
  }

  const tmpFile = path.join(require('os').tmpdir(), `vidassist-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`);
  const args = ['--no-playlist', '--no-warnings', '-q', '-f', 'bestvideo[ext=mp4][vcodec^=avc]+bestaudio[ext=m4a]/best[ext=mp4]/best', '--merge-output-format', 'mp4', '--ffmpeg-location', path.dirname(FFMPEG), '-o', tmpFile, url];
  const p = spawn(YTDLP, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let err = '';
  p.stderr.on('data', d => err += d);
  p.on('close', code => {
    if (code !== 0) { try { require('fs').unlinkSync(tmpFile); } catch {} ; if (!res.headersSent) return res.status(500).send(err); return; }
    const filename = safeName(resolvedTitle) + '.mp4';
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'video/mp4');
    const fs = require('fs');
    const stream = fs.createReadStream(tmpFile);
    stream.pipe(res);
    stream.on('close', () => { try { fs.unlinkSync(tmpFile); } catch {} });
    req.on('close', () => { try { stream.destroy(); } catch {} });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`VidAssist API running on http://localhost:${PORT}`));
