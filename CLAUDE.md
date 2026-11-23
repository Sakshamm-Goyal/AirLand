# LandConnect

Land marketplace for **Buyers, Sellers and Brokers** with listing-anchored chat and **in-app voice/video calls where nobody's phone number is ever shared**. Built for the LandConnect technical assignment (due **Wed 25 Nov 2026, 23:59 IST**). The evaluated core is the call lifecycle: initiate → ring → accept / reject → end.

## Repo map

```
apps/api        Fastify 5 + Socket.IO 4 + Drizzle (Postgres) + LiveKit server SDK. Runs TS directly on Node 24 (type stripping, no build).
apps/mobile     Expo SDK 58 · React Native 0.88 (New Architecture) · Expo Router · LiveKit RN. Dev build only (WebRTC ≠ Expo Go).
packages/shared Zod schemas, DTO types, Socket.IO event maps, ₹/land-unit formatters. Imported by BOTH apps: this is the contract.
docs/           PLAN (timeline), ARCHITECTURE (design), DECISIONS (research), UX (screen spec), SUBMISSION (deliverables).
```

## Commands

```bash
pnpm install                     # root; node-linker=hoisted (RN needs flat node_modules)
pnpm db:up                       # docker compose: Postgres :5433 + LiveKit dev server :7880 (key devkey / secret)
pnpm --filter api db:migrate     # apply drizzle/*.sql
pnpm --filter api db:seed        # demo users buyer|seller|broker@demo.test, password in src/db/seed.ts
pnpm dev:api                     # http://localhost:4000 · /health · /openapi.json
pnpm dev:mobile                  # Metro for the dev client
pnpm check                       # biome + tsc (all packages) + vitest (all packages) — must pass before "done"
pnpm --filter api livekit:check  # proves LIVEKIT_* creds + a real participant token work (self-hosted or Cloud)

# schema change: edit apps/api/src/db/schema.ts, then
pnpm --filter api db:generate    # writes a new drizzle/NNNN_*.sql; commit it; never edit an applied migration

# mobile
cd apps/mobile && npx expo install <pkg>             # ALWAYS, never pnpm add, for anything with native code
npx eas-cli build -p android --profile preview         # installable APK (cloud; no local Android SDK needed)
npx eas-cli build -p android --profile development     # dev client APK, then `pnpm dev:mobile`
```

API tests need Postgres: `TEST_DATABASE_URL=postgres://lc:lc@localhost:5433/landconnect_test` (default). The global setup drops and recreates that database every run.

## Architecture rules (do not break these)

1. **The contract lives in `packages/shared`.** New endpoint or socket event → add its Zod schema / type / event signature there first; both apps then fail to compile until they agree. Never hand-write a payload type inside an app.
2. **Privacy is enforced in one place.** Other users' data leaves the API only through `toPublicUser()` / `toListing()` in `apps/api/src/dto.ts`. No phone, no email, approximate coords (2 dp ≈ 1.1 km) unless the viewer owns the listing. The test "never leaks phone numbers" guards this; keep it green.
3. **Authorization = role guard + ownership in SQL.** `preHandler: can('seller','broker')` for role; ownership goes in the `WHERE` (`and(eq(id), eq(ownerId, me))`) so a foreign id updates 0 rows → 404. Never fetch-then-check.
4. **REST for state, Socket.IO for events.** Messages are sent over the socket (ack carries the saved message for optimistic-UI reconciliation via `clientId`), everything else is REST. Server emits to `user:<id>` rooms only; never trust a client-supplied userId: it comes from the verified JWT in the handshake.
5. **Calls: our server owns signalling, LiveKit owns media.** State machine in `apps/api/src/realtime/calls.ts`. Calls are only possible between members of a 2-person conversation (which only exists after a listing enquiry), respecting `call_policy` and blocks. Every terminal state goes through `settle()` exactly once (persist → chat bubble → `call:closed` to both).
6. **Known ceiling:** call state is in process memory → API runs as **one instance**. Scale-out path: Socket.IO Redis adapter + Redis `SET NX` for accept. Don't add a second instance without doing this.
7. **Errors:** throw `HttpError(status, userFacingMessage)`; the global handler returns `{ error, fields? }`. Validation errors map to `fields` for inline form errors. 5xx messages are generic; details go to the log.
8. **Images** are stored in Postgres (`uploads` table, served with `immutable` cache headers) because free hosts wipe disk. Client compresses to ≤1600 px JPEG q0.75 before upload. Move to object storage + CDN past ~1 GB.

## Calling quality (low latency, clear audio)

LiveKit SFU (WebRTC/UDP, TURN fallback built in) — one hop to the nearest edge, no peer mesh.

- **Audio:** Opus with `dtx: true` (silence ≈ 0 kbps) and `red: true` (redundant packets → survives ~10–20% loss, common on Indian 4G). `audioPreset: AudioPresets.speech` for 1:1 voice; music preset is pointless for speech.
- **Capture:** `echoCancellation`, `noiseSuppression`, `autoGainControl` all on (hardware AEC on Android via WebRTC). Configure `AudioSession` (iOS `playAndRecord` + `voiceChat` mode; Android `communication` audio type) **before** connecting, start it before `connect`, stop it after.
- **Video:** `simulcast` + `dynacast: true` + `adaptiveStream: { pixelDensity: 'screen' }`: subscribers only receive the layer they render; publishers stop encoding unused layers. Camera 720p capture, h264 first (hardware encoders on low-end Android), VP8 fallback.
- **Speed to first frame:** the callee's LiveKit token is minted at accept and returned in the ack; the caller's arrives in `call:accepted`, so both connect in parallel (no extra round trip). Ring timeout 30 s; reconnect replays pending invites.
- **Network:** socket.io is `transports: ['websocket']` with 10 s ping, `connectionStateRecovery` 60 s. In call UI, show LiveKit `ConnectionQuality` and a "Reconnecting…" state, never a frozen frame.
- Test every call change on two physical phones, one on mobile data. Emulators hide NAT/TURN and audio-routing bugs.

## Mobile engineering rules

- **Expo changes every SDK. Don't trust memory.** Before using an Expo/RN API, check the SDK 58 docs (`https://docs.expo.dev/versions/v58.0.0/`, index at `https://docs.expo.dev/llms.txt`). See `apps/mobile/AGENTS.md`.
- **Routing:** Expo Router, typed routes. Screens live in `src/app/` only; everything else in `src/{components,features,lib,theme}`. Tabs use `NativeTabs` (real native tab bar: Material 3 on Android, system tab bar on iOS).
- **React Compiler is on** → don't sprinkle `useMemo`/`useCallback`/`memo`; write plain components. Keep render pure.
- **Server state = TanStack Query** (`src/lib/queries.ts`, keys in one `qk` object). Socket events update the cache (`setQueryData` / `invalidateQueries`); components never subscribe to the socket directly except through hooks in `src/lib/socket.ts`.
- **Client state = Zustand** (session, active call). Tokens in `expo-secure-store` only. Nothing sensitive in AsyncStorage/MMKV.
- **Lists:** `FlashList` v2 for every list that can grow. **Images:** `expo-image` with `transition` + `recyclingKey`; never RN `<Image>` for remote images.
- **Animation:** Reanimated 4 (UI thread) for anything gesture/scroll-driven; `LayoutAnimation`/JS-thread animation is banned on scroll paths.
- **Forms:** react-hook-form + `zodResolver(sharedSchema)`; server `fields` errors are mapped back onto the form.
- **Feedback:** `sonner-native` toasts for outcomes, `expo-haptics` on primary actions (light) and call accept/decline (medium), skeletons not spinners for first load.
- **Accessibility is part of done:** every icon-only button has `accessibilityLabel`; min 48 dp targets; respect font scaling (no fixed-height text containers); contrast ≥ 4.5:1.
- Never edit `ios/` or `android/` (CNG). Native config goes through `app.json` plugins.

## Design system ("Airbnb-like")

The product owner asked for an Airbnb feel after trying "earthy premium" and "luxury minimal": white canvas, big swipeable photos, short text lines, one rose accent, rounded-rectangle buttons, round search pill with a category icon row.

- **Source of truth:** `apps/mobile/src/theme/` — use tokens, never raw hex in components. Light + dark are both first-class.
- **Type:** Plus Jakarta Sans only (closest open match to Airbnb Cereal), sentence case. Scale 12 / 13.5 / 15 / 18 / 22 / 26 / 30. Prices: `price` / `priceLg`, ink, tabular numbers.
- **Shape:** photos and cards 16, buttons/inputs 12, search bar and chips full pills. **Spacing:** 4-pt grid; screen gutter 20. Dividers over boxes for settings and detail sections.
- **Color roles:** `accent` rose = the one main action (`Button` primary), saved heart, active tab, unread dot. `ink` for selected chips/categories, map pins and secondary emphasis. `brand` green only for verified/online/accept. `danger` for end/decline only.
- **Content rules:** ₹ lakh/crore (`formatInr`), always price-per-unit next to total, Indian units (acre, guntha, cent, sq ft, sq yd, hectare), locality → district → state, never survey numbers.
- **Motion:** 200–250 ms ease-out, spring for sheets; ringing avatar pulses; respect Reduce Motion.

## Backend engineering rules

- Fastify route = Zod schemas for `params/querystring/body` via `fastify-type-provider-zod` (types flow into handlers; OpenAPI at `/openapi.json`).
- Drizzle query builder; raw `` sql`…` `` only for things the builder can't express (row comparisons, `distinct on`). Avoid N+1: list endpoints use set-based queries (see `listConversations`, 5 queries total).
- Cursor pagination (`created_at, id`), never offset. Timestamps are `timestamptz(3)` so JS `Date` round-trips exactly.
- Secrets only via env (`src/config.ts` validates at boot; prod refuses the dev JWT secret). Passwords argon2id (OWASP params). Access JWT 15 min; refresh token opaque, hashed, rotated, family-revoked on reuse.
- Rate limits: global 300/min/IP, credential routes 10/min/IP.
- Every bug fix comes with a test that fails without it. Integration tests hit a real Postgres + real Socket.IO (see `apps/api/test/api.test.ts`); no DB mocks.

## Definition of done

`pnpm check` green → feature exercised on a device (or, if no device, `npx expo export -p android` bundles) → UI checked in light **and** dark → no phone/email in any new response → docs/ARCHITECTURE.md updated if a contract changed.

## Git

Conventional commits (`feat(calls): …`, `fix(api): …`). Small commits per vertical slice. Never commit `.env`, keys or `google-services.json` with real keys.
