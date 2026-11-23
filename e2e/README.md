# End-to-end tests

Two isolated browser sessions (a seller and a buyer) drive the real UI against the real API: sign-up, listing with a photo, search, chat both ways, video call accept/end, decline with quick reply, missed call after 30 s, call log, edit and mark sold. Each run signs up fresh users (`*@e2e.test`), so it can run against any seeded or unseeded database; a global teardown deletes them afterwards. Set `MAILPIT_URL` (default `http://localhost:8025`; sign-up and forgot-password read their codes from Mailpit) and `E2E_DATABASE_URL` if your API's database isn't `postgres://lc:lc@localhost:5433/landconnect`.

```bash
pnpm db:up && pnpm --filter api db:migrate      # Postgres
pnpm dev:api                                     # API on :4000
pnpm --filter mobile web                         # app on :8081 (web build)
pnpm e2e                                         # uses your installed Chrome
```

The web build swaps native audio/video and Google Maps for stand-ins (see `apps/mobile/web-preview/`), so these tests cover the app's UI, its API and the call signalling. Media itself is verified with `pnpm --filter api livekit:check` and on two phones.
