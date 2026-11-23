# LandConnect: research and technical decisions

Free-tier figures were checked on 23 Nov 2026 and change often. Confirm them on each vendor's pricing page before quoting them in the submission.

---

## 1. What already exists

| Product | Market | What it does well | Gap LandConnect fills | What we borrow |
|---|---|---|---|---|
| 99acres, MagicBricks, Housing.com | India, all property | Huge inventory, filters, locality pages | Land is just a filter. Contact is a lead form or phone reveal, so your number goes to many agents. | Filter chips, price-per-unit display |
| NoBroker | India, owner-direct | Cuts out brokers; owner contact sits behind a paid plan | Contact still means sharing phone numbers; brokers are excluded | "Contact without a broker" messaging, privacy as a selling point |
| OLX / Facebook Marketplace | Classifieds | Chat is anchored to a listing, so every thread has context | No calling, no roles, not built for land | **Conversation = (buyer, listing)** with the listing card pinned in the chat |
| LandWatch, Land.com, LandSearch, Acres.com | US, land-only | Map-first browsing, acreage, land-type filters, parcel lines | US only, no in-app calls | Map tab as a first-class tab, land-specific specs (road access, water, zoning) |
| Landeed | India, land records | Title / record search (RTC, 7/12, EC) | Not a marketplace | "Title" field on listings; future integration idea |
| WhatsApp | Messaging | The interaction model Indian land deals already run on | Not a marketplace; exposes numbers | Bottom tabs, chat list density, header call buttons, full-screen call UI, call log |

**Positioning line for the README:** *Land deals in India already happen on WhatsApp calls. LandConnect keeps that familiar flow but ties every chat and call to a listing and never shares anyone's phone number.*

---

## 2. Calling: the options compared

| Option | Type | RN / Expo support | Ringing (incoming / accept / reject) built in? | Free tier (verify) | Lock-in | Effort for us | Verdict |
|---|---|---|---|---|---|---|---|
| **LiveKit** | Open-source SFU (Apache-2.0) + managed Cloud | `@livekit/react-native` + Expo config plugin | No. We build it on Socket.IO (~200 lines). | Cloud "Build" plan is free; third parties cite ~5,000 WebRTC participant-min/month | Low: can self-host the same server | Medium | **Primary** |
| **Stream Video** | Proprietary SaaS | RN SDK; Expo 50+ with dev build | **Yes**: ringing API, CallKit / Android Telecom, push | "Free for Makers": <5 people & <$10k MRR → $100/month video credit | High | Low | **Fallback** (decision gate Tue 12:00) |
| Agora | Proprietary | RN SDK, mature | No (separate signalling product) | 10,000 min/month free | High | Medium | Solid, but proprietary with no advantage over LiveKit here |
| ZEGOCLOUD | Proprietary | UIKit "Call Kit" with call invitation + prebuilt UI | Yes, prebuilt | 10,000 min free at signup | High | Low | Fastest demo, but a black box that's hard to explain in an interview |
| Daily | Proprietary | RN SDK | No | Free tier | High | Medium | Fine, no edge here |
| Jitsi Meet SDK | Open source | RN SDK wraps the whole Jitsi UI | No 1:1 ringing | Free (self-host / meet.jit.si) | Low | Low for rooms, poor for 1:1 calls | Good for rooms only; its own UI clashes with ours |
| Twilio Video | Proprietary | No official RN SDK | No | Paid | High | High | Avoid: announced end of life in 2024 and later reversed; uncertain roadmap |
| Raw `react-native-webrtc` + own signalling + coturn | Open source | Yes | Build everything | Pay for TURN or host coturn | None | **High**: NAT/TURN, mesh vs SFU, renegotiation | Teaches the most, but too risky for a 2.5-day deadline |

### Decision
**LiveKit for media + our own Socket.IO signalling for the call lifecycle.**

Why:
1. **The evaluated behaviour is ours.** Initiate, receive, accept, reject and end are the server state machine in ARCHITECTURE §7. In the interview you explain code you wrote, not an SDK switch.
2. **One media stack for 1:1 calls and meeting rooms.** An SFU handles three or more people; peer-to-peer mesh doesn't scale past two or three.
3. **Open source with a managed tier.** Free to start, self-hostable later, no lock-in story to defend.
4. **TURN included,** so calls work on Indian mobile networks behind carrier NAT.
5. **Permission model fits RBAC.** Our server mints a 10-minute token per user per room, so only conversation members can join.

**Fallback trigger:** if a two-phone call isn't reliable by **Tue 24 Nov 12:00 IST**, swap to Stream Video's ringing flow. Auth, listings, chat and maps stay unchanged; only `src/calls/` and `realtime/calls.ts` change.

---

## 3. Messaging

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Own Socket.IO + Postgres** | Already needed for call signalling; one connection; full control of privacy rules | We write unread counts and pagination ourselves | **Chosen** |
| Stream Chat | WhatsApp-grade UI kit | Second vendor, proprietary, overkill | No |
| Supabase Realtime | Postgres changes streamed to clients | Row-level-security policies to learn; a second realtime channel next to Socket.IO | No |
| Firebase / Firestore | Offline sync | Second database, rules language | No |

## 4. Maps

| Option | Cost | Pros | Cons | Verdict |
|---|---|---|---|---|
| **react-native-maps** (Google on Android, Apple Maps on iOS) | Maps SDK for mobile has no per-load charge; needs a key and a billing-enabled Google Cloud project | Native look, mature, Expo support | Key setup | **Chosen** |
| MapLibre RN + OpenStreetMap / MapTiler | Free / free tier | Fully open source, no Google | More setup, a style URL needed | Fallback |
| Mapbox | Free tier, then paid | Beautiful styles | Token + pricing | No |

Reverse geocoding uses `expo-location` (the device's OS geocoder): free, no extra key. **Places autocomplete is skipped**; the centre-pin picker plus "use my location" covers listing creation.

## 5. Backend: Node.js vs FastAPI
Both are allowed. **Node.js + TypeScript:**
- One language across app and API; request/response types can be shared.
- Socket.IO and `livekit-server-sdk` are first-class in Node.
- FastAPI would also work (with `python-socketio` and the LiveKit Python SDK). Pick it if Python is your stronger language; the architecture stays the same.

## 6. Database, storage, ORM
- **Supabase** gives managed Postgres and Storage on one free project. We use it as plain Postgres plus file storage, **not** Supabase Auth, because we build auth ourselves.
- Alternatives: Neon (Postgres) + Cloudinary (images). Equally good, two vendors.
- **ORM:** schema-first SQL (ARCHITECTURE §4), then Drizzle or `prisma db pull` for types. Constraints live in SQL, where they can't be bypassed.

## 7. Auth

| Option | Verdict |
|---|---|
| **Own JWT (argon2id + access/refresh rotation)** | **Chosen.** The brief evaluates auth mechanisms, so we show them. |
| Supabase Auth / Firebase Auth / Clerk | Faster, but hides the part being evaluated |
| Phone OTP (MSG91, Twilio Verify) | Costs money per SMS; P2 |

Tokens live in `expo-secure-store` (Keychain / Keystore), never in AsyncStorage.

## 8. Mobile framework
**Expo with a development build**, not Expo Go (WebRTC is a native module). Expo Router for navigation, EAS for the APK. The bare React Native CLI adds nothing here and costs setup time.

## 9. Hosting

| Piece | Choice | Free-tier caveat |
|---|---|---|
| API + Socket.IO | Render web service | Sleeps when idle; ping `/health` before the demo. Railway or Fly as alternatives. |
| Postgres + images | Supabase | Pauses after a week of inactivity on the free plan |
| Media | LiveKit Cloud | Minutes cap (see §2) |
| Push | Expo Push Service (FCM underneath) | Needs FCM credentials uploaded to EAS for Android |
| APK | EAS Build `preview` profile with `"buildType": "apk"` | Free queue can be slow; local Gradle as fallback |

**Prototype cost: ₹0.**

## 10. UI libraries (kept minimal)
- `lucide-react-native`: icons
- `@gorhom/bottom-sheet`: map preview sheet (or a plain absolute `View` if time is short)
- `@shopify/flash-list`: feed and chat lists
- `expo-image`: cached images
- No full UI kit: a small `theme.ts` with tokens (see UX.md) keeps it consistent.

---

## Sources
- LiveKit pricing: https://livekit.com/pricing · quotas: https://docs.livekit.io/deploy/admin/quotas-and-limits/
- LiveKit Expo quickstart: https://docs.livekit.io/transport/sdk-platforms/expo/ · plugin: https://github.com/livekit/client-sdk-react-native-expo-plugin
- Stream Video RN ringing tutorial: https://getstream.io/video/sdk/react-native/tutorial/ringing/ · Expo ringing setup: https://getstream.io/video/docs/react-native/advanced/incoming-calls/ringing-setup/expo/
- Agora RTC pricing: https://www.agora.io/en/pricing/agora-rtc · docs: https://docs.agora.io/en/video-calling/overview/pricing
- ZEGOCLOUD pricing: https://www.zegocloud.com/pricing
