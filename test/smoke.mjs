#!/usr/bin/env node
// Smoke test against real YouTube videos. Run after a yt-dlp update or a script change:
//   node test/smoke.mjs
// Needs network plus the same tools as yt-watch.mjs. Takes about a minute.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../plugins/yt-reference-search/skills/ai-yt-watch/scripts/yt-watch.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'yt-watch-test-'));
let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n      ${detail.trim().split('\n').join('\n      ')}`}`);
  if (!ok) failed++;
};
const watch = (args, env) => spawnSync(process.execPath, [SCRIPT, ...args],
  { encoding: 'utf8', env: { ...process.env, ...env } });
// The printed block for one video, from its "== title" line to the next blank line.
const block = (stdout, id) => stdout.split('\n\n').find((b) => b.includes(id)) || '';

// 1. One batch covering the four kinds of video.
const out = path.join(tmp, 'batch');
const r = watch(['dQw4w9WgXcQ', 'XfP_v0VNGMM', 'CV2P-xsEiYE', 'hnpKktKooZg', '--out', out, '--keep']);
const normal = block(r.stdout, 'dQw4w9WgXcQ');
check('regular video: 1 grid + English transcript', /1 grid\(s\), 6x5/.test(normal) && /transcript \(en\)/.test(normal), normal || r.stderr);
const shorts = block(r.stdout, 'XfP_v0VNGMM');
check('Shorts: vertical 10x3 grid + Korean transcript', /10x3/.test(shorts) && /transcript \(ko\)/.test(shorts), shorts || r.stderr);
const noSubs = block(r.stdout, 'CV2P-xsEiYE');
check('no captions: grid + "none available"', /1 grid\(s\)/.test(noSubs) && /transcript: none available/.test(noSubs), noSubs || r.stderr);
const uploaded = block(r.stdout, 'hnpKktKooZg');
check('uploaded captions only, no language tag: transcript found', /transcript \(en-IN\)/.test(uploaded), uploaded || r.stderr);

// 2. full then quick on the same folder: quick must list only its own grid.
const rerun = path.join(tmp, 'rerun');
watch(['dQw4w9WgXcQ', '--mode', 'full', '--no-subs', '--out', rerun]);
const q = watch(['dQw4w9WgXcQ', '--mode', 'quick', '--no-subs', '--out', rerun]);
check('re-run in quick after full: 1 grid listed', (q.stdout.match(/grid_\d+\.jpg/g) || []).length === 1, q.stdout || q.stderr);

// 3. ffmpeg failing: transcript still returned, temp files removed.
// ponytail: sh shim only, so this check is skipped on Windows.
if (process.platform !== 'win32') {
  const bin = path.join(tmp, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'ffmpeg'), '#!/bin/sh\ncase "$1" in -version|--version) exit 0;; esac\nexit 1\n', { mode: 0o755 });
  const fail = path.join(tmp, 'fail');
  const f = watch(['dQw4w9WgXcQ', '--out', fail], { PATH: `${bin}${path.delimiter}${process.env.PATH}` });
  const left = fs.existsSync(path.join(fail, 'dQw4w9WgXcQ')) ? fs.readdirSync(path.join(fail, 'dQw4w9WgXcQ')) : [];
  check('grid failure: "grids: failed" + transcript kept',
    /grids: failed/.test(f.stdout) && /transcript \(en\)/.test(f.stdout), f.stdout || f.stderr);
  check('grid failure: only transcript.txt left', left.join() === 'transcript.txt', left.join(', '));
}

// 4. Storyboard parsing with reordered part headers, on the .mhtml kept by the batch.
// extractSheets isn't exported (the script runs on import), so its source is lifted out.
const src = fs.readFileSync(SCRIPT, 'utf8');
const extractSheets = new Function('fs', 'path', 'Buffer',
  `${src.match(/^function extractSheets[\s\S]*?^}/m)[0]}\nreturn extractSheets;`)(fs, path, Buffer);
const mhtml = fs.readFileSync(path.join(out, 'dQw4w9WgXcQ', 'sb.mhtml')).toString('latin1');
const parts = [...mhtml.matchAll(/(Content-type: image\/\w+\r\n)(Content-length: (\d+)\r\n)([\s\S]*?\r\n\r\n)/gi)];
const expected = parts.map((m) => mhtml.substr(m.index + m[0].length, +m[3]));
const variants = {
  'length before type': (m, body) => m[2] + m[1] + m[4] + body,
  'base64 encoding before type': (m, body) => 'Content-Transfer-Encoding: base64\r\n' + m[1] + m[4] +
    Buffer.from(body, 'latin1').toString('base64').replace(/.{76}/g, '$&\r\n'),
};
for (const [name, rewrite] of Object.entries(variants)) {
  let text = '', pos = 0;
  parts.forEach((m, i) => {
    text += mhtml.slice(pos, m.index) + rewrite(m, expected[i]);
    pos = m.index + m[0].length + expected[i].length;
  });
  text += mhtml.slice(pos);
  const dir = fs.mkdtempSync(path.join(tmp, 'mhtml-'));
  fs.writeFileSync(path.join(dir, 'sb.mhtml'), Buffer.from(text, 'latin1'));
  const got = extractSheets(path.join(dir, 'sb.mhtml'), dir).map((f) => fs.readFileSync(f).toString('latin1'));
  const same = got.filter((g, i) => g === expected[i]).length;
  check(`storyboard parsing, ${name}: ${same}/${expected.length} sheets identical`,
    expected.length > 0 && got.length === expected.length && same === expected.length);
}

// 5. An option with its value missing.
const m = watch(['dQw4w9WgXcQ', '--out']);
check('missing option value: clear message, exit 1', m.status === 1 && /--out needs a value/.test(m.stderr), m.stderr);

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
