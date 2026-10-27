# yt-reference-search

Find YouTube reference videos for your next promo, ad or brand film, and let Claude watch any YouTube video in seconds without downloading it.

**One install, two skills:**

- **yt-reference-search**: proposes 5–8 reference videos across production techniques, each with the element worth borrowing.
- **ai-yt-watch**: watches any YouTube video from its transcript and preview frames. Up to 2x faster, 99% less data and 92% fewer image tokens than download-and-extract tools.

## Install

### 1. Dependencies

```bash
# macOS
brew install node yt-dlp ffmpeg deno

# Windows
winget install OpenJS.NodeJS yt-dlp.yt-dlp Gyan.FFmpeg DenoLand.Deno
```

`deno` is the JavaScript runtime recent yt-dlp versions need for YouTube.

### 2. Plugin (Claude Code)

```
/plugin marketplace add dljake/yt-reference-search
/plugin install yt-reference-search@yt-reference-search
```

Or copy both folders in `plugins/yt-reference-search/skills/` into `~/.claude/skills/`.

## Reference search

Ask for references in plain words:

- "제조업 기업 홍보영상 레퍼런스 찾아줘"
- "find reference videos for a calm, premium skincare ad"
- "3D 제품 광고 레퍼런스 찾아줘, 쇼츠도 포함해서"

What you get:

1. About 20 candidates searched on YouTube, nothing downloaded
2. All of them screened in under 4 minutes
3. 5–8 picks, each tagged with its technique and the one element worth borrowing (tone & color, shooting & lighting, editing rhythm, directing, graphics)

| Techniques covered | |
|---|---|
| Live action, AI-generated, typography, 2D animation, 3D, CG/VFX | Motion graphics, stop motion, drone/FPV, interview/documentary, mixed |

Name a technique ("3D only", "typography") to focus on it; otherwise you get at least three different concepts side by side. Shorts are included when you ask for them.

Want music, cut length and camera moves too? Name the picks and Claude hands them to a video-understanding tool, if you have one installed.

## Watch any YouTube video

Just give Claude a link:

- "Summarize this talk: <url>"
- "What's the visual tone of these three videos? <url> <url> <url>"
- "이 영상 보고 구성이랑 분위기 정리해줘 <url>"

It fetches only two things YouTube already provides:

- **Transcript**: captions in the spoken language, as plain text with `[m:ss]` markers
- **Thumbnail grid**: YouTube's seek-bar preview images, 30 to an image

Claude picks the cheapest mode that answers the question:

| Mode | Gets | 3-min video |
|---|---|---|
| `text` | transcript + title | ~1k tokens, ~10s |
| `quick` (default) | + 1 grid (30 frames) | ~2.5k tokens, ~15s |
| `full` | + up to 4 grids | ~4k+ tokens, ~15–20s |

**Why it's fast:** measured against a tool that downloads the video and extracts frames, on the same videos:

| | Download-and-extract | ai-yt-watch | |
|---|---|---|---|
| Time (12-min video) | 16.0s | 7.5s | **2x faster** |
| Data downloaded | 38.5 MB | 0.4 MB | **99% less** |
| Image tokens | ~19,700 | ~1,500 | **92% fewer** |
| 20 videos | | 3m 38s | **under 4 minutes** |

**Best for** what's said, structure, look and feel. For music and camera moves, pair it with a video-understanding tool.

Run the script directly:

```bash
node plugins/yt-reference-search/skills/ai-yt-watch/scripts/yt-watch.mjs <url-or-id> [...] \
  [--mode text|quick|full] [--lang ko] [--frames N] [--no-subs] [--out DIR]
```

Output goes to `yt-watch/<video-id>/`: `transcript.txt`, `grid_01.jpg`, …

## 한국어 안내

**설치 한 번으로 두 가지 기능을 씁니다.**

**① 레퍼런스 영상 찾기 (`yt-reference-search`)**
"홍보영상 레퍼런스 찾아줘"라고 하면 유튜브 후보 20개를 4분 안에 훑고, **실사, AI, 타이포그래피, 2D, 3D, CG, 모션그래픽, 스톱모션, 드론, 인터뷰, 믹스** 등 연출 기법별로 다양한 컨셉 5~8개를 제안합니다. 영상마다 가져올 요소(톤·색감, 촬영·조명, 편집 리듬, 연출, 그래픽)를 짚어 줍니다.
- "3D로만", "타이포 위주로"처럼 기법을 정하면 그 기법만 찾습니다.
- 쇼츠(세로 영상)는 "쇼츠도 포함해줘", "세로 영상만"이라고 할 때 넣습니다.
- 음악이나 카메라 무빙까지 보고 싶은 영상은 번호로 말하면 영상 분석 도구로 넘겨 봅니다.

**② 유튜브 영상 보기 (`ai-yt-watch`)**
유튜브 영상을 **내려받지 않고 몇 초 만에** 봅니다. 유튜브가 이미 만들어 둔 자막과 미리보기 썸네일만 가져와서, 다운로드 방식보다 **최대 2배 빠르고, 데이터는 99%, 이미지 토큰은 92% 아낍니다.**
- `text`: 자막만. 내용 요약이나 발언 확인용입니다.
- `quick` (기본): 자막 + 영상 전체를 담은 썸네일 그리드 1장. 분위기와 화면 파악용입니다.
- `full`: 그리드 최대 4장. 장면 구성이나 편집 분석용입니다.

내용, 구성, 분위기 파악에 강합니다. 음악과 카메라 무빙까지 보려면 영상 분석 도구와 함께 쓰세요.

**설치:** 위 `brew install`(macOS) 또는 `winget install`(Windows) 명령으로 도구를 설치한 뒤, Claude Code에서 `/plugin marketplace add dljake/yt-reference-search`와 `/plugin install yt-reference-search@yt-reference-search`를 차례로 실행합니다.

## Notes

- Only publicly available captions and preview thumbnails are fetched. Respect YouTube's Terms of Service and creators' rights; use outputs for personal review and research.
- Batches are spaced out to avoid HTTP 429 rate limits.

## License

MIT
