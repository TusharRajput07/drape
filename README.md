# Drape

A phone-first web app (installable PWA) for managing your own clothes: upload them with the background
removed in the browser, build and save outfits, keep a Lookbook and a Wishlist, and see wardrobe stats.

The specs in [`spec/`](spec/) describe everything; start with [`spec/00-overview.md`](spec/00-overview.md).

## Apps

- `client/`: React 19 + TypeScript + Vite (http://localhost:5173)
- `server/`: Express 5 + TypeScript API (http://localhost:4000/api/v1)

## Run locally

Needs Node 24 LTS.

1. Install everything: `npm run install:all`
2. Copy `server/.env.example` to `server/.env` and `client/.env.example` to `client/.env`, then fill in the values.
3. Start both apps: `npm run dev`

Format the code with `npm run format`.

## Try it on your phone

Installing the app needs HTTPS the phone trusts, so the phone reaches your laptop through a temporary
Cloudflare tunnel.

1. Once: install the tunnel tool with `winget install Cloudflare.cloudflared` (no account needed).
2. Run `npm run phone`. It starts the API, builds the app, serves it on http://localhost:4173 (the app forwards
   `/api` to the API) and opens a tunnel.
3. Open the `https://….trycloudflare.com` address it prints on your phone. The address is public while the
   command runs and changes every time.
