# LandConnect: submission kit

## 1. Repo README
Done: [README.md](../README.md) has the features, stack, hosting, run/deploy steps, tests and the demo links. Add the video link to its **Demo** line once it's uploaded.

## 2. Technical documentation
Done: [TECHNICAL.md](TECHNICAL.md) covers technologies, architecture, hard limits, call quality, development approach, the real challenges (R8 crash, Android photo upload, 4 s ring from DB region, India ↔ France congestion, ringing that wouldn't stop, socket crash) and limitations. It links [ARCHITECTURE.md](ARCHITECTURE.md) and [DECISIONS.md](DECISIONS.md).

## 3. AI usage summary
[AI_USAGE.md](AI_USAGE.md) lists what the AI did, the decisions I made, and nine concrete mistakes with how each was caught. **Still to fill in myself:** any other tools used, and the parts I wrote or reworked by hand. Keep it honest.

## 4. Demo video script (4–5 min, two phones side by side)
Record each phone's screen (built-in recorder or `scrcpy --record`) and put them side by side; or film both phones with a third device. Captions help.

| Time | Show | Say (short) |
|---|---|---|
| 0:00 | Title card + both phones | "LandConnect: land marketplace with private in-app calling." |
| 0:15 | Phone A signs up as **Seller**; Phone B as **Buyer** | "Roles decide what you can do." |
| 0:35 | Buyer: Explore, filter chips, open listing | "Price per unit, specs, approximate location; the phone number is hidden." |
| 0:55 | Map tab, tap a marker | "Listings load for the visible map region." |
| 1:10 | Seller: + → create listing with photos + map pin (full-screen picker) → appears in feed. Buyer has no +. | "Only sellers and brokers can list. The API enforces it too." |
| 1:40 | Buyer: Chat → send message → seller receives live | "Every chat is tied to a listing." |
| 2:00 | **Buyer starts a video call → seller rings → Accept** → mute, camera off/on, flip → End | "Initiate, receive, accept, end. No numbers are exchanged." |
| 2:50 | **Buyer calls again → seller Declines** → caller sees "Declined" | "Reject." |
| 3:05 | **Call and let it ring out** → both see "Missed" in Calls | "30-second timeout." |
| 3:20 | Voice call, speaker toggle | "Audio-only works the same way." |
| 3:35 | Deal room: pick people you chat with → members sheet → group video (grid) | "Meeting rooms for site-visit planning. Only people you already talk to, never blocked ones." |
| 4:05 | Profile → allow calls, block / unblock, switch role (buyer → seller) | "Who can call me, and roles can change later." |
| 4:20 | Architecture slide (diagram) | "Expo app, Fastify + Socket.IO signalling, Postgres on Neon, media on LiveKit Cloud." |

Upload as **unlisted** on YouTube (or Google Drive with "anyone with the link"). Check it in incognito.

## 5. Submission email (reply to their email)

```
Subject: Re: LandConnect Technical Assignment: <Your Name>

Hello Team LandConnect,

Please find my submission for the LandConnect assignment below.

GitHub repository: https://github.com/Sakshamm-Goyal/AirLand
Android APK: https://expo.dev/artifacts/eas/rZKuiBP8F9Qk6g1sUZVRsMgzsTS3CTz4LUR5RIDRRKk.apk  (hosted API: https://api.213-136-67-77.sslip.io/health)
Demo video: <link>
Technical documentation: https://github.com/Sakshamm-Goyal/AirLand/blob/main/docs/TECHNICAL.md
AI tools usage summary: https://github.com/Sakshamm-Goyal/AirLand/blob/main/docs/AI_USAGE.md

Highlights:
- In-app voice and video calls with ringing, accept, decline, cancel, missed-call timeout and busy handling (LiveKit Cloud media, my own Socket.IO signalling); calls keep running when the app is minimised
- Buyer / Seller / Broker roles enforced in the API and the UI
- Listings with photos and map locations, map browsing, chat per listing, and group meeting rooms
- Phone numbers are never exposed; calls are only allowed between people in a shared conversation; blocking and validated, rate-limited inputs on the server
- Tested with 38 API integration tests, 9 shared tests and 11 end-to-end flows, and on a physical Android phone

Demo accounts: buyer@demo.test, seller@demo.test, broker@demo.test (password: landconnect123)

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
| How would you scale it? | Redis adapter for Socket.IO and Redis for call state, multiple API instances, PostGIS for geo, object storage + CDN for images. Media is already on LiveKit Cloud. |
| Biggest challenge? | Real ones from TECHNICAL.md: the 4 s ring traced to a Singapore DB behind a France API; video congestion India ↔ France fixed by LiveKit Cloud; Android-only photo upload failure from Expo SDK 58's fetch. |
| What did AI get wrong? | E.g. it let the room endpoint accept any user id, and assumed expo-audio's `remove()` stops playback; both caught by tests / device logs (AI_USAGE.md). |

## 7. Final checklist (Wed 25 Nov, aim for 20:00 IST; hard deadline 23:59)
- [x] Repo public; README renders; no secrets in history (checked before every push)
- [x] API awake (`/health`), seeded, on Neon Frankfurt + LiveKit Cloud
- [x] Docs linked from README (TECHNICAL, AI_USAGE, ARCHITECTURE, DECISIONS)
- [ ] Latest APK installed on two phones: photo upload, call accept / decline / missed, voice + video, group meeting
- [ ] AI_USAGE.md: fill in other tools and the parts I reworked myself
- [ ] Video recorded, unlisted, playable in incognito, under 5 min; link added to README and the email
- [ ] Email sent with all links; copy saved
