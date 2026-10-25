#!/usr/bin/env node
// Let an AI "watch" a YouTube video without downloading it: the transcript as text, and
// YouTube's own seek-bar preview thumbnails stitched into contact-sheet grids.
//
// Usage:
//   node yt-watch.mjs <url-or-id> [more...] [--mode text|quick|full] [--frames N]
//                     [--lang ko,en] [--out DIR] [--keep]
//
// Modes:
//   text   transcript + title only. Fastest, cheapest. Needs yt-dlp.
//   quick  1 grid image (30 frames across the whole video) + transcript. Default.
//   full   a frame every ~4s (up to 120 frames, 30 per grid) + transcript.
//
// Requires yt-dlp (all modes) and ffmpeg/ffprobe (quick, full). Node 18+.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const HELP = `Usage: node yt-watch.mjs <url-or-id> [...] [options]

Options:
  --mode M       text | quick | full   (default: quick)
  --frames N     override the frame budget (30 frames per grid image)
  --lang LIST    subtitle languages, comma separated (default: video language, then en)
  --no-subs      visuals only
  --out DIR      output folder (default: ./yt-watch)
  --keep         keep raw storyboard sheets and info.json
`;

// ---------- args ----------
const argv = process.argv.slice(2);
const opts = { out: 'yt-watch', mode: 'quick', frames: null, lang: null, subs: true, keep: false };
const inputs = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '-h' || a === '--help') { console.log(HELP); process.exit(0); }
  else if (a === '--mode') opts.mode = argv[++i];
  else if (a === '--frames') opts.frames = Math.max(1, parseInt(argv[++i], 10) || 30);
  else if (a === '--lang') opts.lang = argv[++i];
  else if (a === '--no-subs') opts.subs = false;
  else if (a === '--out') opts.out = argv[++i];
  else if (a === '--keep') opts.keep = true;
  else inputs.push(a);
}
if (!inputs.length || !['text', 'quick', 'full'].includes(opts.mode)) { console.error(HELP); process.exit(1); }
if (opts.mode === 'text' && !opts.subs) { console.error('--mode text with --no-subs has nothing to fetch.'); process.exit(1); }

// ---------- helpers ----------
function run(cmd, args, { allowFail = false } = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.error) throw new Error(`${cmd} not found or failed to start: ${r.error.message}`);
  if (r.status !== 0 && !allowFail) {
    const msg = (r.stderr || r.stdout || '').trim().split(/\r?\n/).slice(-3).join('\n');
    throw new Error(`${cmd} exited with ${r.status}: ${msg}`);
  }
  return r;
}

function checkDeps() {
  const need = opts.mode === 'text' ? ['yt-dlp'] : ['yt-dlp', 'ffmpeg', 'ffprobe'];
  const missing = need.filter(
    (c) => spawnSync(c, ['-version'], { encoding: 'utf8' }).error &&
           spawnSync(c, ['--version'], { encoding: 'utf8' }).error);
  if (missing.length) {
    console.error(`Missing: ${missing.join(', ')}\n` +
      'macOS:   brew install yt-dlp ffmpeg deno\n' +
      'Windows: winget install yt-dlp.yt-dlp Gyan.FFmpeg DenoLand.Deno');
    process.exit(2);
  }
}

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function toUrl(s) {
  return /^[\w-]{11}$/.test(s) ? `https://www.youtube.com/watch?v=${s}` : s;
}

function fmtTime(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0'), ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// The storyboard .mhtml holds image parts (webp or jpeg). Each part has headers and
// usually a Content-Length; bodies are raw binary or base64. latin1 keeps byte offsets 1:1.
function extractSheets(mhtmlPath, outDir) {
  const buf = fs.readFileSync(mhtmlPath);
  const text = buf.toString('latin1');
  const re = /content-type:\s*image\/(\w+)/gi;
  const files = [];
  let m;
  while ((m = re.exec(text))) {
    const hdrStart = text.lastIndexOf('\n', m.index) + 1;
    const hdrEnd = text.indexOf('\r\n\r\n', m.index);
    if (hdrEnd < 0) break;
    const head = text.slice(hdrStart, hdrEnd);
    const bodyStart = hdrEnd + 4;
    const lenMatch = head.match(/content-length:\s*(\d+)/i);
    let body;
    if (lenMatch) {
      body = buf.subarray(bodyStart, bodyStart + parseInt(lenMatch[1], 10));
    } else {
      const next = text.indexOf('\r\n--', bodyStart);
      body = buf.subarray(bodyStart, next < 0 ? buf.length : next);
    }
    if (/content-transfer-encoding:\s*base64/i.test(head)) {
      body = Buffer.from(body.toString('latin1').replace(/\s+/g, ''), 'base64');
    }
    const ext = m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase();
    const f = path.join(outDir, `sheet_${String(files.length).padStart(3, '0')}.${ext}`);
    fs.writeFileSync(f, body);
    files.push(f);
    re.lastIndex = bodyStart + body.length;
  }
  return files;
}

// Auto-generated captions repeat each line across rolling cues; keep each line once and
// drop a [m:ss] marker roughly every 20 seconds so the text can be matched to grid cells.
function vttToText(vtt) {
  const out = [];
  const recent = [];
  let cueStart = 0, lastMark = -Infinity;
  for (const raw of vtt.split(/\r?\n/)) {
    const line = raw.trim();
    const t = line.match(/^(?:(\d+):)?(\d+):(\d+)\.\d+\s+-->/);
    if (t) { cueStart = (+(t[1] || 0)) * 3600 + (+t[2]) * 60 + (+t[3]); continue; }
    if (!line || /^(WEBVTT|Kind:|Language:|NOTE|STYLE|\d+$)/.test(line)) continue;
    const clean = line.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
    if (!clean || recent.includes(clean)) continue;
    recent.push(clean); if (recent.length > 4) recent.shift();
    if (cueStart - lastMark >= 20) { out.push(`\n[${fmtTime(cueStart)}] `); lastMark = cueStart; }
    out.push(clean + ' ');
  }
  return out.join('').replace(/ +/g, ' ').trim() + '\n';
}

// ---------- visuals ----------
function makeGrids(info, infoPath, dir, cleanup) {
  const sb = (info.formats || [])
    .filter((f) => /^sb\d+$/.test(f.format_id) && f.width && f.height)
    .sort((a, b) => b.width - a.width)[0];
  if (!sb) return { note: 'no storyboard thumbnails for this video (common for very new, live or restricted videos)', lines: [] };

  run('yt-dlp', ['--no-warnings', '--load-info-json', infoPath, '-f', sb.format_id,
    '-o', path.join(dir, 'sb.%(ext)s')]);
  const mhtml = fs.readdirSync(dir).find((f) => f.startsWith('sb.'));
  if (!mhtml) throw new Error('Storyboard download produced no file.');
  cleanup.push(path.join(dir, mhtml));
  const sheets = extractSheets(path.join(dir, mhtml), dir);
  cleanup.push(...sheets);
  if (!sheets.length) throw new Error('No images found inside the storyboard file.');

  const sizeOf = (f) => run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries',
    'stream=width,height', '-of', 'csv=p=0:s=x', f]).stdout.trim().split('x').map((n) => parseInt(n, 10));
  const cols = sb.columns || Math.max(1, Math.round(sizeOf(sheets[0])[0] / sb.width));
  const rows = sb.rows || Math.max(1, Math.round(sizeOf(sheets[0])[1] / sb.height));
  const [sw, sh] = sheets.length > 1 ? sizeOf(sheets[0]) : [cols * sb.width, rows * sb.height];
  const capacity = sheets.length * cols * rows;
  const tileSec = sb.fps ? 1 / sb.fps : (info.duration || capacity) / capacity;
  // Last sheet is usually only partly filled; ignore the blank tiles after the video ends.
  const realTiles = info.duration ? Math.min(capacity, Math.ceil(info.duration / tileSec)) : capacity;

  const portrait = sb.height > sb.width;
  const cellW = portrait ? Math.round((256 * sb.width / sb.height) / 2) * 2 : 256;
  const cellH = portrait ? 256 : Math.round((256 * sb.height / sb.width) / 2) * 2;
  const [gc, gr] = portrait ? [10, 3] : [6, 5];
  const perGrid = gc * gr;

  // quick: one full grid. full: ~1 frame per 4s, rounded up to whole grids, max 4 grids.
  const wanted = opts.frames || (opts.mode === 'quick' ? perGrid
    : Math.min(4 * perGrid, Math.max(1, Math.ceil((info.duration || 0) / 4 / perGrid)) * perGrid));
  const budget = Math.min(wanted, realTiles);
  const frameSec = (realTiles * tileSec) / budget;

  // The last sheet is often shorter. A size change mid-sequence makes ffmpeg rebuild the
  // filter graph and silently drop buffered tiles, so feed it as a separate padded input.
  const ext = path.extname(sheets[0]);
  const ffIn = ['-framerate', '1', '-i', path.join(dir, `sheet_%03d${ext}`)];
  // Shorts sheets can have odd widths (e.g. 303px of 101px tiles), which yuv420p can't pad or split.
  let chain = `[0:v]format=yuv444p,pad=${sw}:${sh}:0:0:black`;
  const last = sheets[sheets.length - 1];
  if (sheets.length > 1 && sizeOf(last).join('x') !== `${sw}x${sh}`) {
    const tail = path.join(dir, `last${ext}`);
    fs.renameSync(last, tail);
    cleanup.push(tail);
    ffIn.push('-framerate', '1', '-i', tail);
    chain += `[a];[1:v]format=yuv444p,pad=${sw}:${sh}:0:0:black[b];[a][b]concat=n=2:v=1`;
  }
  run('ffmpeg', ['-v', 'error', '-y', ...ffIn,
    '-filter_complex', [
      chain,
      `untile=${cols}x${rows}`,
      // pick exactly `budget` tiles spread evenly over the real ones
      `select='lt(n\\,${realTiles})*gt(floor(n*${budget}/${realTiles})-floor((n-1)*${budget}/${realTiles})\\,0)'`,
      `scale=${cellW}:${cellH}`,
      `tile=${gc}x${gr}:padding=4:color=white`,
    ].join(','),
    '-fps_mode', 'vfr', '-q:v', '3', path.join(dir, 'grid_%02d.jpg')]);

  const grids = fs.readdirSync(dir).filter((f) => /^grid_\d+\.jpg$/.test(f)).sort();
  const lines = grids.map((g, i) => {
    const from = i * perGrid * frameSec;
    const to = Math.min(((i + 1) * perGrid - 1) * frameSec, info.duration || Infinity);
    return `  ${path.join(dir, g)}  ${fmtTime(from)}-${fmtTime(to)}`;
  });
  return {
    note: `${grids.length} grid(s), ${gc}x${gr} cells left-to-right then top-to-bottom, one cell every ~${frameSec.toFixed(1)}s`,
    lines,
  };
}

// ---------- subtitles ----------
// Without --lang we ask for ".*-orig": the captions in the language actually spoken.
// Only one transcript is kept, so translated duplicates never cost tokens.
const subFlags = (langs) => ['--write-subs', '--write-auto-subs', '--sub-langs', langs, '--sub-format', 'vtt'];

function pickTranscript(dir, rateLimited, langs) {
  const vtts = fs.readdirSync(dir).filter((f) => /^v\..+\.vtt$/.test(f));
  const langOf = (f) => f.slice(2, -4);
  const prefs = langs ? langs.split(',').map((s) => s.trim()) : [];
  const chosen = prefs.map((p) => vtts.find((f) => langOf(f) === p)).find(Boolean)
    || vtts.find((f) => !langOf(f).endsWith('-orig')) || vtts[0];
  if (!chosen) {
    return rateLimited ? 'transcript: rate-limited by YouTube (HTTP 429), retry in a few minutes'
      : 'transcript: none available';
  }
  const text = vttToText(fs.readFileSync(path.join(dir, chosen), 'utf8'));
  const file = path.join(dir, 'transcript.txt');
  fs.writeFileSync(file, text);
  for (const v of vtts) fs.rmSync(path.join(dir, v));
  return `transcript (${langOf(chosen).replace(/-orig$/, '')}): ${file}  (${text.length} chars)`;
}

// ---------- per video ----------
function processVideo(input) {
  const url = toUrl(input);
  // One yt-dlp call fetches metadata and subtitles together; separate calls cost ~5s more.
  const r = run('yt-dlp', ['--no-warnings', '--no-playlist', '--skip-download', '--no-simulate',
    '--write-info-json', ...(opts.subs ? subFlags(opts.lang || '.*-orig') : []),
    '-o', path.join(opts.out, '%(id)s', 'v'), '-O', '%(id)s', '--', url], { allowFail: true });
  const id = (r.stdout || '').trim().split(/\r?\n/).pop();
  const dir = path.join(opts.out, id || '_');
  const infoPath = path.join(dir, 'v.info.json');
  if (!id || !fs.existsSync(infoPath)) {
    throw new Error((r.stderr || 'yt-dlp failed').trim().split(/\r?\n/).slice(-2).join('\n'));
  }
  const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
  const cleanup = [infoPath];
  let rateLimited = /429/.test(r.stderr || '');
  // Dubbed videos have several "-orig" tracks; prefer the one in the video's own language.
  let langs = opts.lang || (info.language
    && [`${info.language}-orig`, `${info.language.split('-')[0]}-orig`].join(','));

  // Videos with only uploaded captions have no "-orig" track; ask once more by language.
  if (opts.subs && !opts.lang && !fs.readdirSync(dir).some((f) => f.endsWith('.vtt'))) {
    if (rateLimited) sleep(20000);
    langs = [...new Set([info.language, 'en'].filter(Boolean))].join(',');
    const r2 = run('yt-dlp', ['--no-warnings', '--load-info-json', infoPath, '--skip-download',
      ...subFlags(langs), '-o', path.join(dir, 'v')], { allowFail: true });
    rateLimited = /429/.test(r2.stderr || '');
  }

  const out = [`== ${info.title}`,
    `${info.channel || info.uploader || '?'} | ${fmtTime(info.duration || 0)} | ${info.upload_date || '?'} | ${info.webpage_url || url}`];
  if (opts.mode !== 'text') {
    const g = makeGrids(info, infoPath, dir, cleanup);
    out.push(`grids: ${g.note}`, ...g.lines);
  }
  if (opts.subs) out.push(pickTranscript(dir, rateLimited, langs));

  if (!opts.keep) for (const f of cleanup) fs.rmSync(f, { force: true });
  console.log(out.join('\n') + '\n');
}

// ---------- main ----------
checkDeps();
fs.mkdirSync(opts.out, { recursive: true });
let failed = 0;
inputs.forEach((input, i) => {
  if (i > 0) sleep(5000); // spacing requests avoids YouTube rate limits on batches
  try { processVideo(input); }
  catch (e) { failed++; console.log(`== FAILED ${input}\n${e.message}\n`); }
});
process.exit(failed === inputs.length ? 1 : 0);
