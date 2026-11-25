# AI tools usage

| Tool | Used for |
|---|---|
| Claude (Claude Code) | Research (competitor apps, calling SDK comparison), planning, architecture and schema design, the clickable HTML prototype, most of the implementation of the API, shared contract and mobile app, tests, deployment (VM, Neon, LiveKit Cloud), on-device debugging over `adb`, docs |
| ChatGPT | Researching similar land and property apps and sites (what they show, how they handle contact privacy), and UI inspiration |
| Dribbble, Behance (design references, not AI) | Visual inspiration for the listing cards, map, chat and call screens |

## How AI was used

- **Research and decisions.** AI compared calling options (LiveKit, Stream, Agora, ZEGOCLOUD, Jitsi, Twilio, raw WebRTC) and drafted the trade-offs. LiveKit for media with our own signalling was chosen so the call lifecycle being evaluated is code I can explain line by line.
- **Implementation.** Code was generated in vertical slices, each checked with `pnpm check` (lint, typecheck, tests) and an Android bundle build before committing.
- **Verification.** The API's behaviour is pinned by integration tests against a real Postgres and real socket clients, and the main flows by 11 Playwright end-to-end tests, not by trusting generated code. Every bug fix came with a test that failed before it.
- **Real devices.** I installed each APK on a physical Android phone, reported what felt wrong (scrolling, ringing, map pins, refresh, uploads), and the fixes were confirmed from `adb logcat` / `dumpsys` output and server logs rather than guesses.

## Decisions I made

- The visual direction (Airbnb-like) after trying two other styles.
- Product rules: numbers never shared; roles switchable later; blocked people can't be messaged, called or added to groups (WhatsApp-like); emoji allowed in chat but not in names, titles or places; hard limits on every input.
- Infrastructure: hosting the API on my own VM, moving the database next to it (Frankfurt) after the 4 s ring, and moving media to LiveKit Cloud after the congestion showed up.

## What AI got wrong (and how it was caught)

| Mistake | How it was caught | Fix |
|---|---|---|
| Used React Native APIs that 0.88 removed (`StyleSheet.NamedStyles`, `absoluteFillObject`) | Typecheck | Checked the installed type definitions and used the current APIs |
| Pagination cursor longer than its own validation limit, so page 2 was always empty | Integration test | Raised the limit; stored timestamps at millisecond precision |
| Blocking only prevented *new* chats and calls; messages still went through | Noticed while building the block screen | Server-side check plus a regression test |
| Numeric input turned "2." into "2", so decimal areas couldn't be typed | Code review | Kept the raw text in state |
| Navigated to the call screen as a route, which can race with other navigation | Code review | Rebuilt it as a root-level overlay |
| Ran the formatter over Markdown, which padded tables and broke inline code in docs | `git diff` review | Restored the docs; excluded Markdown from the formatter |
| Created the database in the project's existing region (Singapore) without checking it against the API's region (France) | A call took ~4 s to ring; per-query timing showed ~165 ms each | New Neon project in Frankfurt; ring ~0.3 s |
| Release builds kept R8 shrinking on by default | The APK closed on launch on my phone; `adb logcat` showed a class removed by R8 | Turned off minification for release |
| Sent photos as React Native `{ uri }` FormData parts, which Expo SDK 58's `fetch` can't send | Upload failed on the phone only; server logs showed no request arrived | Send an `expo-file-system` `File`; server checks the bytes |
| Assumed `remove()` stops an expo-audio player | Ringing continued after Cancel; `dumpsys audio` showed two players still running | Long-lived players that are paused to stop |
| Socket handlers trusted their payloads | A test with a malformed payload crashed the process | Schema guard and rate limit on every socket event |
| The room endpoint accepted any user id | Noticed while adding the "no blocked people" rule | Contacts-only check, plus tests |
| Timestamp colour hard-coded for a dark bubble, invisible in dark mode | I spotted the empty space under my message | Use the bubble's text colour |
| The web preview's LiveKit stand-in lacked a hook the new meeting grid used | Playwright screenshot showed an error screen | Added it to the stand-in (phones use the real SDK) |
| `git add -A` committed a PDF from the repo root | Reviewing the pushed commit | Removed it and rewrote the 3 affected commits |

## Parts I wrote or reworked myself

- **Call audio routing.** Tested voice and video calls on two physical phones and reworked the routing: earpiece for voice, loudspeaker for video, a speaker toggle while ringing that carries into the call, and ringback/ringtone that stop the moment a call is answered or cancelled.
- **Cross-region latency.** Diagnosed a call that took ~4 s to ring (the API in France, the database in Singapore, ~165 ms per query) and resolved it by moving the database to the API's region: about 7 ms per query and ~0.3 s to ring.
- **Calling and video conferencing on LiveKit Cloud.** After measuring congestion on the self-hosted India ↔ France media path, moved 1:1 calls and group meetings to LiveKit Cloud's nearest edge (connect time ~77 ms vs ~190 ms) and tuned the weak-connection warning so brief dips don't flash it.
- **Optimisation and polish from device testing.** Keyboard and auto-scroll in chat, map pins, pull-to-refresh, photo upload on Android, calls staying alive when the app is minimised, and the WhatsApp-style meeting grid.
- **The demo video:** recorded the calls on the phones and chose the scenes, order and timing.

## What I can explain without AI

The full call flow (invite → ring → accept / reject / timeout → LiveKit join → end), why accept is race-free, token minting and scope, refresh-token rotation and reuse detection, the RBAC guard plus ownership-in-SQL pattern, the privacy DTO, and the schema.
