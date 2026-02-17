# Friday Agent Ops

A minimal Next.js dashboard that connects to the **OpenClaw Gateway WebSocket** and shows:

- sessions (`sessions.list`)
- transcripts (`chat.history`)
- raw live events (useful for audit-style debugging)

## Why

You wanted an “Agent Ops” console: who your OpenClaw agents are, what they’re working on, and an **audit log of every message (including intermediate reasoning)**.

This repo is the **MVP UI + protocol client**. Next step is tightening the audit surface (e.g. `logs.tail`, per-run tool output, and device-auth).

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Configure

In the app:

- Gateway URL: `ws://127.0.0.1:18789` (local)
- For remote: use `wss://<magicdns>/` (recommended via Tailscale Serve)
- Token: your `gateway.auth.token` (if configured)

## Important: device auth / pairing

This MVP **does not implement device pairing/signature** yet.

So, remote browser connects may require one of:

- access via localhost/SSH tunnel
- temporarily setting `gateway.controlUi.allowInsecureAuth: true`

(We’ll implement proper device identity + signing next.)

## Deploy (Vercel)

- Push to GitHub
- Import in Vercel

Because the browser connects directly to your Gateway, you must make the Gateway reachable from the browser (typically via **Tailscale Serve** or another HTTPS reverse proxy).
