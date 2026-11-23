# AI tools usage

> Draft. Sections marked `<…>` are yours to fill in honestly; evaluators want to see judgment, not a tool list.

| Tool | Used for |
|---|---|
| Claude (Claude Code) | Research (competitor apps, calling SDK comparison), planning and timeline, architecture and schema design, the clickable HTML prototype, most of the first implementation of the API, shared contract and mobile app, integration tests, docs |
| `<other tools you used, e.g. Copilot, ChatGPT>` | `<what for>` |

## How AI was used

- **Research and decisions.** AI compared calling options (LiveKit, Stream, Agora, ZEGOCLOUD, Jitsi, Twilio, raw WebRTC) and drafted the trade-offs. LiveKit for media with our own signalling was chosen so the call lifecycle being evaluated is code I can explain line by line.
- **Implementation.** Code was generated in vertical slices, each checked with `pnpm check` (lint, typecheck, tests) and an Android bundle build before committing.
- **Verification.** The API's behaviour is pinned by integration tests against a real Postgres and real socket clients, not by trusting generated code.

## What AI got wrong (and how it was caught)

| Mistake | How it was caught | Fix |
|---|---|---|
| Used React Native APIs that 0.88 removed (`StyleSheet.NamedStyles`, `absoluteFillObject`) | Typecheck | Checked the installed type definitions and used the current APIs |
| Pagination cursor longer than its own validation limit, so page 2 was always empty | Integration test | Raised the limit; stored timestamps at millisecond precision |
| Blocking only prevented *new* chats and calls; messages still went through | Noticed while building the block screen | Server-side check plus a regression test |
| Numeric input turned "2." into "2", so decimal areas couldn't be typed | Code review | Kept the raw text in state |
| Navigated to the call screen as a route, which can race with other navigation | Code review | Rebuilt it as a root-level overlay |
| Ran the formatter over Markdown, which padded tables and broke inline code in docs | `git diff` review | Restored the docs; excluded Markdown from the formatter |
| `<anything you found on real devices>` | | |

## Parts I wrote or reworked myself

`<e.g. tuning call audio routing after testing on two phones, …>`

## What I can explain without AI

The full call flow (invite → ring → accept / reject / timeout → LiveKit join → end), why accept is race-free, token minting and scope, refresh-token rotation and reuse detection, the RBAC guard plus ownership-in-SQL pattern, the privacy DTO, and the schema.
