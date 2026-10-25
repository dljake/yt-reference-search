---
name: ai-yt-watch
description: Watch any YouTube video in seconds without downloading it, up to 2x faster, 99% less data and 90% fewer tokens than download-and-extract tools, and 20 videos screened in under 4 minutes. Reads the transcript and YouTube's own preview frames as one grid image. Use whenever the user shares YouTube links to watch, summarize, compare, quote or describe, e.g. "watch this video", "compare these three videos", "what does he say at the end". Not for saving videos. / 유튜브 영상을 내려받지 않고 몇 초 만에 봅니다. 다운로드 방식보다 최대 2배 빠르고, 데이터 99%, 토큰 90%를 아끼며, 영상 20개를 4분 안에 훑습니다. 유튜브 링크를 주며 "이 영상 봐줘", "영상 내용 요약해줘", "이 유튜브 어떤 분위기야", "세 영상 비교해줘"라고 할 때 씁니다. 영상 저장용은 아닙니다.
---

# ai-yt-watch

Lets you "watch" a YouTube video for a few thousand tokens instead of downloading it. The script fetches only:
- **the transcript** (captions in the spoken language, as plain text with `[m:ss]` markers), and
- **grid images** built from the low-res thumbnails YouTube already makes for its seek-bar preview (one every ~2s), 30 frames per image.

## Pick the cheapest mode that answers the question

| Mode | What you get | Cost for a 3-min video | Use when |
|---|---|---|---|
| `text` | title, channel, length + transcript | ~1k tokens, ~10s | the question is about what is said: summary, quotes, facts, arguments |
| `quick` (default) | + 1 grid image covering the whole video | ~2.5k tokens, ~15s | the user wants to know what it looks like or feels like, or you need both |
| `full` | + a frame every ~4s, up to 4 grid images | ~4k+ tokens, ~15–20s | scene-by-scene structure, editing rhythm, shot lists, detailed visual comparison |

Start low and step up only if needed: if a `text` answer leaves a visual question open, rerun that video in `quick`. A grid image costs about 1,500 tokens, so `full` on a long video adds up fast.

## Run

The script is in this skill's `scripts/` folder:

```bash
node <skill-dir>/scripts/yt-watch.mjs <url-or-id> [more...] [--mode text|quick|full] [--lang ko] [--frames N] [--no-subs] [--out DIR]
```

- Several URLs in one call run as a batch, spaced a few seconds apart to avoid YouTube rate limits. For a playlist, list its videos first: `yt-dlp --flat-playlist --print url <playlist-url>`.
- Captions default to the language actually spoken. Pass `--lang` (e.g. `--lang ko`, or `--lang en,ko` in order of preference) only when the user needs a specific language; uploaded captions in that language are preferred over auto-generated ones.
- `--no-subs` skips the transcript when only visuals matter (e.g. music videos, b-roll).
- Outputs go to `./yt-watch/<video-id>/` (`transcript.txt`, `grid_01.jpg`, …). The script prints, per video, the title line, each grid's path with the time span it covers, and the transcript path. Read those files directly; nothing else needs opening.

## Read the output

- **Grid**: cells run left-to-right, then top-to-bottom, evenly spaced; the printed line gives the seconds between cells, so cell *k* is at about `(k-1) × interval` from the grid's start time. Use it to tie visuals to the transcript's `[m:ss]` markers.
- **Transcript**: auto-generated captions can mishear names and technical terms; treat odd words as likely errors, and lean on the title or on-screen text in the grid to correct them.

Answer what the user asked, in the form they asked for. When your answer depends on things these inputs cannot show, say so briefly: there is no audio (music, voice tone, sound design), no motion (camera moves, transitions, animation), and thumbnails are too small for fine on-screen text.

## Requirements and troubleshooting

Needs `yt-dlp` (all modes), `ffmpeg` + `ffprobe` (`quick`/`full`) and Node 18+. Recent yt-dlp also needs a JavaScript runtime such as `deno` for YouTube. If the script says a tool is missing, give the user the install command it prints (macOS: `brew install yt-dlp ffmpeg deno`).

- **"no storyboard thumbnails"**: some very new, live, private or age-restricted videos have none. Continue with the transcript and say visuals were unavailable.
- **"transcript: none available"**: the video has no captions. Use `quick`/`full` visuals and the title/description.
- **Rate-limited (HTTP 429)**: YouTube throttles caption requests in big batches. Wait a few minutes and rerun only the affected videos.
- **"Sign in to confirm", signature or JS errors**: usually an outdated yt-dlp or missing JS runtime. Suggest `brew upgrade yt-dlp` (or `yt-dlp -U`) and installing `deno`.
- The `yt-watch/` folder is scratch output. Delete it when done unless the user wants to keep it.
