# Production deploy (one VM)

API + LiveKit run with `docker compose` (host networking) on the VM; Postgres is Neon; TLS comes from the Caddy already on the box.

| | |
|---|---|
| API | `https://api.213-136-67-77.sslip.io` (`/health`) |
| LiveKit | `wss://rtc.213-136-67-77.sslip.io`, TURN on UDP 3478 |
| Secrets | `/srv/landconnect/deploy/.env.api`, `.env.livekit` (on the VM only, mode 600) |

Redeploy from your machine:

```bash
rsync -az --delete --exclude .pnpm-store --exclude node_modules --exclude .git --exclude '.env*' \
  --include apps/mobile/package.json --exclude 'apps/mobile/*' ./ root@213.136.67.77:/srv/landconnect/
ssh root@213.136.67.77 'cd /srv/landconnect/deploy && docker compose -p landconnect up -d --build'
```

Migrations run from your machine against Neon's direct URL: `DATABASE_URL=$DATABASE_URL_UNPOOLED pnpm --filter api db:migrate` (values in `.env.local`, written by `neon deploy`).

Firewall (ufw): TCP 7881, UDP 3478, 30000–40000 (TURN relay), 50000–60000 (RTC). Ports 4000/7880 are only reachable from Caddy's Docker network.
