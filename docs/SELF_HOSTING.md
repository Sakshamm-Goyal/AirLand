# Running calls on your own LiveKit server

LiveKit is open source (Apache-2.0). The app only needs three settings in `apps/api/.env`: `LIVEKIT_URL`, `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`. LiveKit Cloud is optional managed hosting of the same server.

Check any setup with:

```bash
pnpm --filter api livekit:check
```

It confirms the server accepts the key and that a participant token like the one a phone gets on Accept can join.

## 1. On your laptop (phones on the same Wi-Fi)

Good for development and for recording the demo.

```bash
brew install livekit                       # or: docker compose up livekit
livekit-server --dev --bind 0.0.0.0 --node-ip <your LAN IP>
```

`apps/api/.env`:

```
LIVEKIT_URL=ws://<your LAN IP>:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
```

macOS asks whether `livekit-server` may accept incoming connections: choose **Allow**. If you missed the prompt: System Settings → Network → Firewall → Options → add `livekit-server` and allow it. Phones need TCP 7880–7881 and UDP 7882 on the laptop.

## 2. On a server (works over 4G / any network)

Needs a VM with a public IP and **UDP open**. Render, Railway and most PaaS hosts can't do UDP; use a VM (Oracle Cloud free tier, Hetzner, DigitalOcean, AWS Lightsail).

1. Point a domain at the VM, for example `rtc.example.com`.
2. Generate a config with LiveKit's tool: `docker run --rm -it -v $PWD:/output livekit/generate`. It writes a `docker-compose.yml` with LiveKit, Caddy for TLS, and Redis, and enables the built-in TURN server on 443/UDP 3478.
3. Open the firewall: TCP 443, 7881; UDP 3478 and 50000–60000.
4. `docker compose up -d`, then set:

```
LIVEKIT_URL=wss://rtc.example.com
LIVEKIT_API_KEY=<from generated livekit.yaml>
LIVEKIT_API_SECRET=<from generated livekit.yaml>
```

TURN matters in India: many mobile carriers use carrier-grade NAT, and without TURN some 4G-to-4G calls connect but carry no media.

## 3. LiveKit Cloud (no server to run)

Free Build plan: 5,000 participant-minutes a month (a 10-minute 1:1 call uses 20), 100 concurrent connections, 50 GB downstream. Limits are fixed on the free plan, so calls stop at the cap instead of billing you. Ringing, accept and decline run on our API, so only connected calls count.
