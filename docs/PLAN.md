# LandConnect: delivery plan

- **Issued:** Fri 20 Nov 2026
- **Today:** Mon 23 Nov 2026
- **Deadline:** Wed 25 Nov 2026, 23:59 IST
- **Time left:** about 2.5 working days. The plan assumes about 12 focused hours a day and a 4-hour buffer before the deadline.

---

## 1. What the evaluators will weigh

These come straight from the brief, ranked by how much weight it gives them:

| # | Criterion | What it means for us |
|---|---|---|
| 1 | **Audio + video calling** ("KEY", "primary", "significant consideration") | A call between two real phones works on video: initiate, ring, accept, reject, end. |
| 2 | Functional completeness | Every requirement (R1–R7) works at least once in the demo video. |
| 3 | Technical understanding | You can explain every file. Build signalling yourself so you can explain it. |
| 4 | UI/UX | A clean, WhatsApp-like flow: tabs, chat list, call screens. |
| 5 | Code organisation | Two apps, small folders, typed contracts, a readable README. |

**Rule:** nothing else starts until a two-device video call works.

---

## 2. Scope (MoSCoW)

### Must (P0): maps 1:1 to the brief

| Req | Feature | Done when |
|---|---|---|
| R1 | Register / login, JWT access + refresh, roles Buyer / Seller / Broker | Wrong role gets `403`. Token refresh works after 15 min. |
| R1 | Role-based UI + API guards | Buyer sees no "List land" button. `POST /listings` as a buyer returns `403`. |
| R2 | Community feed with images, price, area, location, filters | Seeded with 15 realistic listings |
| R3 | Create / edit / mark-sold listing with photos, price, area + unit, pin | Owner-only edit is enforced server-side |
| R4 | Map tab with markers; pin picker when creating | Markers load for the visible region (bbox query) |
| R5 | 1:1 chat tied to a listing; chats list with unread counts | Messages persist and arrive live over the socket |
| R5 | Meeting room = group conversation + group video call | Three participants in one call |
| R6 | Voice + video call: initiate, incoming screen, accept, reject, cancel, end | Works on two phones over 4G, not only Wi-Fi |
| R6 | Call log (missed / declined / answered + duration) | Calls tab lists the `calls` rows |
| R7 | Phone numbers never returned by the API; calls only between conversation members; block | API responses contain no `phone` field |

### Should (P1)
- Ring when the app is in the background or killed (high-priority push, then replay on reconnect).
- Approximate location (about 1 km) until a buyer enquires.
- Busy handling ("On another call"), and the call stops ringing on your other devices once answered.
- Save / favourite listings.
- Share my number in this chat (an opt-in reveal).

### Could (P2)
- Read receipts and typing indicator.
- Image messages, and sharing the exact location pin in chat.
- Radius search ("within 20 km") and marker clustering.
- A broker-verification review queue.

### Won't (this round), named in the docs so it reads as a choice
- Payments, KYC, SMS OTP (costs money, and the brief doesn't ask for it).
- iOS device build (needs a paid Apple developer account). The demo ships as an Android APK; the code is cross-platform.
- End-to-end media encryption, call recording, an admin panel.

---

## 3. Timeline

### Day 0: Mon 23 Nov (today, about 6 h). Goal: de-risk calling
| Time | Task |
|---|---|
| 1 h | Accounts: GitHub repo, Supabase (Postgres + Storage bucket `listing-images`), LiveKit Cloud project, Firebase/Expo push. Collect env vars. |
| 1 h | `apps/api`: Express + TS, SQL migration (schema in ARCHITECTURE §4), `/auth/register`, `/auth/login`, `/auth/refresh`, `/me` |
| 1 h | Socket.IO server with JWT handshake auth; `user:<id>` rooms; `call:invite / accept / reject / cancel / end` + 30 s timeout |
| 2 h | `apps/mobile`: `create-expo-app`, Expo Router, `expo-dev-client`, LiveKit plugins. Login screen plus a debug "Call user" screen. **First native build with `npx expo run:android`. This is the slow step.** |
| 1 h | Two phones: A calls B, B sees the incoming screen, accepts, both see and hear each other, either side ends. |

**Exit check:** a video call between two physical phones. If it doesn't work, Day 1 morning goes to it.

### Day 1: Tue 24 Nov. Goal: every P0 feature works end to end
| Time | Task |
|---|---|
| 09–11 | Finish calling: reject, cancel, missed after 30 s, busy, call log rows, mute / camera / flip / speaker, a call bubble in chat |
| **12:00** | **Decision gate.** If calls aren't reliable, switch media + ringing to Stream Video (DECISIONS §3) and keep everything else. |
| 11–14 | Listings API (CRUD, filters, cursor pagination, bbox), signed image upload, seed script; Explore feed + listing detail |
| 14–16 | Create / edit listing: image picker + resize, centre-pin map picker, reverse geocode, validation |
| 16–17 | Map tab: markers, bottom-sheet preview, region → bbox query |
| 17–20 | Chat: `POST /listings/:id/enquire`, messages over the socket + persisted, chats list, unread counts, pinned listing card |
| 20–22 | Deploy the API to Render; point the app at it; test calls over 4G on both phones (this exercises TURN) |

### Day 2: Wed 25 Nov. Goal: polish, package, submit
| Time | Task |
|---|---|
| 09–11 | Deal rooms (group conversation + LiveKit group call), privacy settings screen, block |
| 11–12 | Background ring via high-priority push (stretch; skip if it fights you) |
| 12–14 | UI polish: empty / loading / error states, icons, dark mode check, copy pass |
| **14:00** | **Start the release APK build** (EAS `preview` profile, or a local Gradle build as fallback) |
| 15–17 | Record the demo video (script in SUBMISSION.md), upload it as unlisted |
| 17–20 | README, technical doc, AI usage summary; open every link in an incognito window |
| **20:00** | **Send the submission email.** Four hours of buffer remain. |

---

## 4. Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| WebRTC can't run in Expo Go | Certain | Use a dev build (`expo-dev-client`) from hour one |
| Calls fail on mobile data / strict NAT | Medium | LiveKit Cloud includes TURN. Test on 4G on Day 1, not on demo day. |
| First native build eats hours | High | Start it before writing app code; keep Android Studio + one USB phone ready |
| EAS free build queue is slow | Medium | Start at 14:00 on Day 2; fallback `cd android && ./gradlew assembleRelease` |
| Render free instance sleeps (cold start) | High | Call `/health` before recording; Railway or Fly as alternatives |
| Background ringing setup drags on | Medium | Foreground ringing over the socket meets the brief. Push is P1. |
| Google Maps key / billing friction | Low–Medium | react-native-maps on Android needs a Maps SDK key. If blocked, use `UrlTile` with OpenStreetMap tiles. |
| Scope creep | High | Use the cut list below, in order. |

## 5. Cut list (if behind, cut in this order)
1. Background push ringing (explain the design in docs instead)
2. Image messages, typing indicator, read receipts
3. Marker clustering, radius search
4. Dark mode polish
5. Edit-listing photo re-ordering
6. Deal rooms as a separate entity. Fallback: a group call from a 3-person conversation using the same code path.

**Never cut:** any part of R6, the APK, or the demo video.

## 6. Definition of done
- [ ] Repo is public; `README` has setup steps that work from a clean clone
- [ ] `apps/api/.env.example` and `apps/mobile/.env.example` list every variable
- [ ] Seed script creates 3 demo users (one per role) and 15 listings
- [ ] APK installs on a fresh phone and talks to the hosted API
- [ ] Video shows: role signup, feed, map, create listing, chat, **video call accept**, **call reject**, **missed call**, voice call, meeting room, privacy settings
- [ ] Docs: technical doc + AI usage summary linked from README
- [ ] Every link checked in an incognito window
