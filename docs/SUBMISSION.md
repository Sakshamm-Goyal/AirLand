# LandConnect: submission kit

## 1. Repo README template

````markdown
# LandConnect

Land marketplace for buyers, sellers and brokers, with in-app chat and audio/video calling. Nobody's phone number is shared.

**Demo:** APK <link> · Video <link> · API <https://...onrender.com/health>

## Features
- Sign up as Buyer, Seller or Broker (role-based permissions in the API and UI)
- Community feed of land listings, filters, listing detail
- Create/edit listings with photos, price, area units, and a map pin
- Map view of listings
- Chat tied to each listing; deal rooms with group video meetings
- **Voice and video calls**: ring, accept, decline, cancel, missed after 30 s, busy, call log
- Privacy: phone numbers never exposed, approximate locations, call permissions, block

## Stack
Expo (React Native, TypeScript) · Node.js, Express, Socket.IO · PostgreSQL (Supabase) · LiveKit (WebRTC) · react-native-maps

## Run locally
### API
```bash
cd apps/api && cp .env.example .env   # fill in values
npm install && npm run migrate && npm run seed && npm run dev
```
### Mobile (needs a dev build; Expo Go can't run WebRTC)
```bash
cd apps/mobile && cp .env.example .env
npm install && npx expo run:android
```
Demo accounts (seeded): buyer@demo.test / seller@demo.test / broker@demo.test, password in `seed.ts`.

## Docs
- [Technical documentation](docs/ARCHITECTURE.md)
- [Decisions and research](docs/DECISIONS.md)
- [AI tools usage](docs/AI_USAGE.md)
````

## 2. Technical documentation: what to hand in
The brief asks for: technologies, architecture, implementation decisions, development approach, major challenges. Link `ARCHITECTURE.md` + `DECISIONS.md`, and add a one-page `TECHNICAL.md` with:

1. **Overview** (3 lines) and the system diagram.
2. **Technologies:** the stack table.
3. **Architecture:** the REST vs socket split; the call sequence diagram.
4. **Key decisions:** LiveKit + own signalling; own JWT; one socket for chat and calls; privacy by DTO.
5. **Development approach:** risk-first (calling on Day 0), vertical slices, decision gate.
6. **Challenges and fixes.** Fill these in from real experience; typical ones:
   - WebRTC needs a native build → moved off Expo Go to a dev client.
   - Calls on 4G failed without TURN → LiveKit Cloud TURN; tested off Wi-Fi.
   - Ringing when the app was closed → push wakes the app, the server replays pending invites on reconnect.
   - Double answer on two devices → first accept wins, `call:answered_elsewhere`.
7. **Limitations and next steps:** iOS CallKit/PushKit, PostGIS radius search, E2EE, horizontal scaling (Redis adapter).

## 3. AI usage summary template (`docs/AI_USAGE.md`)
Be specific and honest. Evaluators want to see judgment, not a list of tools.

```markdown
# AI tools usage

| Tool | Used for |
|---|---|
| Claude | Architecture planning, comparing calling SDKs, the DB schema draft, the call state machine design, docs drafts, a UI mockup |
| Cursor / Copilot | Autocomplete for boilerplate (Express routes, RN styles), test scaffolding |

## How I worked with it
- I used AI to compare options, then made the decisions myself. For example, I chose LiveKit + my own signalling over a fully managed ringing SDK so I'd own the call lifecycle.
- I reviewed, ran and debugged every generated snippet on two devices. Example of something AI got wrong: <one real example>.
- Parts I wrote or reworked by hand: <call handlers / auth refresh rotation / ...>.

## What I can explain without AI
The full call flow (invite → ring → accept/reject/timeout → LiveKit join → end), token minting, RBAC guards, the privacy DTO, and the schema.
```

## 4. Demo video script (4–5 min, two phones side by side)
Record each phone's screen (built-in recorder or `scrcpy --record`) and put them side by side; or film both phones with a third device. Captions help.

| Time | Show | Say (short) |
|---|---|---|
| 0:00 | Title card + both phones | "LandConnect: land marketplace with private in-app calling." |
| 0:15 | Phone A signs up as **Seller**; Phone B as **Buyer** | "Roles decide what you can do." |
| 0:35 | Buyer: Explore, filter chips, open listing | "Price per unit, specs, approximate location; the phone number is hidden." |
| 0:55 | Map tab, tap a marker | "Listings load for the visible map region." |
| 1:10 | Seller: FAB → create listing with photos + map pin → appears in feed. Buyer has no FAB. | "Only sellers and brokers can list. The API enforces it too." |
| 1:40 | Buyer: Chat → send message → seller receives live | "Every chat is tied to a listing." |
| 2:00 | **Buyer starts a video call → seller rings → Accept** → mute, camera off/on, flip → End | "Initiate, receive, accept, end. No numbers are exchanged." |
| 2:50 | **Buyer calls again → seller Declines** → caller sees "Declined" | "Reject." |
| 3:05 | **Call and let it ring out** → both see "Missed" in Calls | "30-second timeout." |
| 3:20 | Voice call, speaker toggle | "Audio-only works the same way." |
| 3:35 | Deal room with 3 people (third device or emulator) → group video | "Meeting rooms for site-visit planning." |
| 4:05 | Profile → privacy settings, block | "Who can see my number, who can call me." |
| 4:20 | Architecture slide (diagram) | "Expo + LiveKit media, Socket.IO signalling, Postgres." |

Upload as **unlisted** on YouTube (or Google Drive with "anyone with the link"). Check it in incognito.

## 5. Submission email (reply to their email)

```
Subject: Re: LandConnect Technical Assignment: <Your Name>

Hello Team LandConnect,

Please find my submission for the LandConnect assignment below.

GitHub repository: <link>
Android APK: <link>  (hosted API: <link>/health)
Demo video: <link>
Technical documentation: <link to docs/TECHNICAL.md>
AI tools usage summary: <link to docs/AI_USAGE.md>

Highlights:
- In-app voice and video calls with ringing, accept, decline, cancel, missed-call timeout and busy handling (LiveKit media, my own Socket.IO signalling)
- Buyer / Seller / Broker roles enforced in the API and the UI
- Listings with photos and map locations, map browsing, chat per listing, and group meeting rooms
- Phone numbers are never exposed; calls are only allowed between people in a shared conversation

Demo accounts: buyer@demo.test, seller@demo.test, broker@demo.test (password: <...>)

I'd be happy to walk through the code and a live call demo.

Regards,
<Name>
<Phone> · <LinkedIn>
```

## 6. Interview prep: likely questions

| Question | Crisp answer |
|---|---|
| Why LiveKit and not raw WebRTC? | An SFU handles 3+ people and TURN for mobile NAT. Raw P2P would mean building signalling, TURN and mesh scaling in 2.5 days. I still own the call lifecycle. |
| Why not Stream / ZEGOCLOUD with ringing built in? | Faster, but the ringing logic is what you're evaluating, so I built it. Stream was my fallback with a decision time. |
| How does the callee get a call if the app is closed? | High-priority push opens the app; the socket reconnects; the server replays invites still ringing (within 30 s). Native CallKit/ConnectionService is the next step. |
| What stops two devices both answering? | Accept removes the call from the ringing map atomically. The second accept gets `gone`; other devices get `answered_elsewhere`. |
| How do you stop strangers calling? | Calls need a shared conversation, which only starts from a listing enquiry. Blocks and the call policy are checked server-side. |
| Where do phone numbers live? | Only in `users.phone`. One serializer for other users omits it. The only path to it is the opt-in share per conversation. |
| How is RBAC enforced? | Role claim in the JWT → `can('seller','broker')` middleware. Ownership is part of the SQL `where`, so another user's edit returns 0 rows → 404. |
| How do refresh tokens work? | Opaque token, stored hashed, rotated on every use. Reusing a revoked one revokes the family (theft detection). |
| How would you scale it? | Redis adapter for Socket.IO and Redis for call state, multiple API instances, PostGIS for geo, CDN for images, LiveKit Cloud scales media. |
| Biggest challenge? | Use your real one. Likely ringing reliability across app states, or 4G NAT. |
| What did AI get wrong? | Have one concrete example ready (an outdated SDK API, or a missing ownership check). |

## 7. Final checklist (Wed 25 Nov, before 20:00 IST)
- [ ] Repo public; README renders; no secrets committed (`git log -p | grep -i secret`)
- [ ] APK link downloads without a login; installs on a phone that has never had the app
- [ ] API awake (`/health`), seeded, CORS fine
- [ ] Video unlisted and playable in incognito; under 5 min
- [ ] Docs linked from README
- [ ] Email sent with all links; copy saved
