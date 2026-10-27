---
name: yt-reference-search
description: Find and shortlist YouTube reference videos for a promo, ad, brand film or other video project. Searches about 20 candidates, screens them fast with ai-yt-watch thumbnail grids, and returns 5-8 picks across production techniques (live action, AI, typography, 2D, 3D, CG/VFX, motion graphics, stop motion, drone, mixed), each with the element worth borrowing. Use when the user asks to find reference videos, e.g. "find reference videos for our promo", "3D product ad references". Not for watching a video the user already linked (use ai-yt-watch). / 홍보영상, 광고, 브랜드필름 레퍼런스를 찾아 줍니다. 유튜브 후보 20개를 빠르게 훑어 실사, AI, 타이포그래피, 2D, 3D, CG 등 연출 기법별로 다양한 컨셉 5~8개를 제안하고, 영상마다 가져올 요소를 짚어 줍니다. "레퍼런스 영상 찾아줘", "홍보영상 레퍼런스 서치", "3D 광고 레퍼런스 찾아줘"라고 할 때 씁니다.
---

# yt-reference-search

Order: **search → screen with ai-yt-watch → show the shortlist and stop.** Sound and motion analysis happens only for videos the user picks.

## 0. Read the brief
Take the purpose (what is being promoted), tone, length and format from the request. If something is missing, don't ask: pick a sensible default, keep going, and state your assumptions in one line at the top of the result.

**Technique.** Techniques: live action / AI-generated / typography / 2D animation / 3D / CG & VFX / motion graphics / stop motion / drone & FPV / interview & documentary / mixed (live action + graphics).
If the request names one or more techniques, search only those. Otherwise aim for variety: the final picks span **at least 3 techniques**, with no more than 3 picks of one technique.

**Format: Shorts are opt-in.** By default search landscape videos only. Include vertical videos (Shorts) only when the request asks for them, e.g. "Shorts", "Reels", "TikTok", "vertical", "쇼츠", "릴스", "세로". If it asks for vertical only, keep only vertical videos.

## 1. Find 20 candidates
- List YouTube results without downloading anything:
  ```bash
  yt-dlp --flat-playlist --no-warnings --print "%(id)s | %(title)s | %(duration_string)s | %(channel)s | %(view_count)s" "ytsearch15:<query>"
  ```
- Broad queries ("promo video") return movie trailers. Run specific queries that name the industry, product or tone, in the user's language and in English (e.g. "industrial manufacturing brand film", "제조업 기업 홍보영상").
- Add technique words to queries (e.g. "3D product animation commercial", "kinetic typography ad", "stop motion brand film", "AI generated commercial"). For variety, spread queries over 3–4 techniques plus 1–2 general ones.
- Drop: movie trailers, tutorials and making-ofs, compilations, ads for production agencies, videos far off in purpose or length, duplicates.
- Non-YouTube videos found by web search (Vimeo, Instagram, …) can be candidates; mark them "non-YouTube".
- When Shorts are wanted, add "#shorts" to some queries.
- Search results don't say which videos are vertical. Collect about 25, then check orientation in one call (about 1.5s per video, nothing downloaded):
  ```bash
  yt-dlp --no-warnings --ignore-errors --print "%(id)s %(width)sx%(height)s" -- <id> <id> ...
  ```
  Height greater than width means vertical. Drop vertical videos unless Shorts were asked for (or drop landscape ones if only vertical was asked for).
- Keep **20** candidates.

## 2. Screen: YouTube candidates → ai-yt-watch
Follow the `ai-yt-watch` skill. Run all YouTube candidates in one call with `--mode quick` (add `--no-subs` if most are music-only).
View every grid and note, per video, its technique and the element worth borrowing.
AI-generated video often looks like live action in thumbnails: call it AI only when the title, description or channel says so (e.g. "AI", "Sora", "Veo", "Runway").

**Pass rule: a video passes if at least one element is clearly strong.** Elements: tone & color / shooting & lighting / editing rhythm / directing & structure (how it is shown: interview-led, one-take, …) / graphics & captions.
Judge quality by that element, not by the whole video: if the element is excellent, the video passes even when other parts are weaker. Look at brand message or story only when the user wants story references.
Non-YouTube candidates are judged from title and description at this stage.

## 3. Show 5–8 and stop
Table: rank | title + link | length | technique | element to borrow.
When two videos offer the same element in the same technique, keep the stronger one. List dropped candidates with a one-line reason each.
End with one line: if any pick needs sound and motion analysis (music, cut length, camera moves, transitions), the user can name it.
Delete the `yt-watch/<video-id>/` folders this run created, then `yt-watch/` itself only if it is now empty.

## 4. Only on request: sound and motion
Sound and motion need a video-understanding tool that hears audio and sees movement. If none is installed, say so and stop at step 3.
Run it only on the videos the user picked (non-YouTube ones too). Tell the user first what that tool sends where (for example, a Gemini-based tool sends the URL to Google). Ask every video the same question so they compare:
> Analyze this as a reference for a promo video: 1) music, narration, sound effects 2) editing pace and cut length 3) transitions and camera movement 4) the 2–3 strongest moments, with timestamps.

Keep that tool's observations separate from what you saw in the grids. If it fails, report it; don't silently switch tools.
Summarize per video: link, technique, element to borrow, sound, editing, movement, key moments with times. For a brief or storyboard, add a table: element | reference (timestamp) | how to apply.
