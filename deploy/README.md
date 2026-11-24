# Production deploy (one VM)

API runs with `docker compose` (host networking) on the VM; Postgres is Neon (project `landconnect-eu`, aws-eu-central-1: keep it in the same region as the VM, a call invite makes several sequential queries and Singapore↔France cost ~4 s per ring); TLS comes from the Caddy already on the box.

| | |
|---|---|
| API | `https://api.213-136-67-77.sslip.io` (`/health`) |
| LiveKit | **LiveKit Cloud** (`LIVEKIT_*` in `.env.api`; free Build plan). The self-hosted server in this compose file is an opt-in fallback profile |
| Secrets | `/srv/landconnect/deploy/.env.api`, `.env.livekit` (on the VM only, mode 600) |

Redeploy from your machine:

```bash
rsync -az --delete --exclude .pnpm-store --exclude node_modules --exclude .git --exclude '.env*' \
  --include apps/mobile/package.json --exclude 'apps/mobile/*' ./ root@213.136.67.77:/srv/landconnect/
ssh root@213.136.67.77 'cd /srv/landconnect/deploy && docker compose -p landconnect up -d --build'
```

Migrations run from your machine against Neon's direct URL: `DATABASE_URL=$DATABASE_URL_UNPOOLED pnpm --filter api db:migrate` (values in `.env.local`, written by `neon deploy`).

Firewall (ufw): only Caddy's Docker network can reach port 4000. The LiveKit UDP/TCP ports are closed while calls run on LiveKit Cloud.

Why Cloud: the VM is in France and users are in India. Self-hosted media made every call India → France → India, and the server logged
repeated "channel congestion" on that path. LiveKit Cloud connects each phone to its nearest edge (~77 ms vs ~190 ms connect time measured from India).
