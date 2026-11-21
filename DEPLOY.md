# Putting Drape online (free)

Drape runs as **one Node server** that serves both the app and the API from a single address
(`https://your-app/` and `https://your-app/api/v1`). The database stays on Neon and the photos on Cloudinary,
both free plans you already have. So the only new thing you need is a free place to run the server.

> Free plans change often. The details below were right when this was written; check each provider's
> pricing page before you sign up.

---

## 0. Before anything else: change the two leaked secrets

The Neon database password and the Cloudinary API secret were pasted into a chat, so treat them as public.
Change both now (it takes five minutes), then use the new values everywhere below.

1. **Neon password**: Neon console → your project → **Roles** (under Branches) → the role in your connection
   string → **Reset password**. Copy the new **pooled** and **direct** connection strings (Dashboard →
   Connect; tick "Connection pooling" for the pooled one). Keep `?sslmode=verify-full` on the end.
2. **Cloudinary secret**: Cloudinary console → **Settings → API Keys** → **Generate New API Key**. Use the new
   key and secret, then delete (or deactivate) the old key.
3. Put the new values into your laptop's `server/.env` too (`DATABASE_URL`, `DIRECT_URL`,
   `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`), so local development keeps working.

---

## Recommended: Render (free web service, Singapore) + a free "keep awake" ping

**Why:** no credit card, deploys straight from GitHub, HTTPS included, and it has a **Singapore** region
(close to India and usually to your Neon database). One free web service gets 750 hours a month, which is
enough to run all month.

**The catch:** a free Render service goes to sleep after 15 minutes without visitors, and the first visit
after that waits about a minute. A free scheduled ping every 10 minutes keeps it awake (step 6). Other
limits: 512 MB memory and a small share of one CPU (fine for Drape; logging in takes a second or two
because passwords are checked slowly on purpose), and 500 build minutes a month (a build takes a few).

### Steps

1. **Sign up** at https://render.com with your GitHub account.
2. **New → Web Service** → pick the `TusharRajput07/drape` repository.
3. Fill in:
   | Setting        | Value                                                                            |
   | -------------- | -------------------------------------------------------------------------------- |
   | Name           | `drape` (your address becomes `https://drape.onrender.com`, or similar if taken) |
   | Region         | **Singapore**                                                                    |
   | Branch         | `main` once the owner has merged v1 (until then: `feature/drape-v1`)             |
   | Root directory | _(leave empty)_                                                                  |
   | Runtime        | Node                                                                             |
   | Build command  | `npm run install:ci && npm run build && npm run db:deploy`                       |
   | Start command  | `npm start`                                                                      |
   | Instance type  | **Free**                                                                         |
4. **Environment variables** (Advanced → Add environment variable). Use the _new_ secrets from step 0:

   | Key                      | Value                                                                                              |
   | ------------------------ | -------------------------------------------------------------------------------------------------- |
   | `NODE_ENV`               | `production`                                                                                       |
   | `NODE_VERSION`           | `24`                                                                                               |
   | `CLIENT_URL`             | your Render address, e.g. `https://drape.onrender.com` (no `/` at the end)                         |
   | `DATABASE_URL`           | Neon **pooled** connection string                                                                  |
   | `DIRECT_URL`             | Neon **direct** connection string                                                                  |
   | `JWT_ACCESS_SECRET`      | a new random value: run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
   | `ACCESS_TOKEN_TTL`       | `15m`                                                                                              |
   | `REFRESH_TOKEN_TTL_DAYS` | `30`                                                                                               |
   | `COOKIE_SAMESITE`        | `lax`                                                                                              |
   | `TRUST_PROXY`            | `1`                                                                                                |
   | `CLOUDINARY_CLOUD_NAME`  | your cloud name                                                                                    |
   | `CLOUDINARY_API_KEY`     | the new key                                                                                        |
   | `CLOUDINARY_API_SECRET`  | the new secret                                                                                     |

   Don't set `PORT`: Render sets it. `TRUST_PROXY=1` tells the server that exactly one proxy (Render's) sits in
   front of it, so the login rate limit sees each person's real address. Never set it to `true`.

5. **Create Web Service.** The first build takes a few minutes. It installs everything, builds the app and the
   server, and applies any new database migrations (`prisma migrate deploy`, which only adds, never wipes).
   When the log shows `API ready on …`, open your address.
6. **Keep it awake**: sign up free at https://cron-job.org, **Create cronjob** → URL
   `https://drape.onrender.com/` (your address) → every **10 minutes** → save. (UptimeRobot's free plan works
   the same way.)
7. Later deploys happen by themselves whenever the branch gets new commits.

Using the same Neon database as on your laptop means everything you've already added is there. If you ever
start a fresh database instead, also run `npm --prefix server run db:seed` once against it (with its
connection strings in `server/.env`), and use a separate Cloudinary account for it (see "Clean-up jobs").

---

## Fallback: Oracle Cloud "Always Free" virtual machine (Mumbai, Hyderabad or Singapore)

**Why:** a real always-on server that never sleeps, in India, free forever.
**The catches:** sign-up asks for a credit or debit card to check you're a real person (Oracle says Always
Free resources are never charged, but you must give one); you set up the server yourself; and Oracle may
reclaim an Always Free machine that sits almost completely idle for a week (Drape's daily clean-up and your
own use normally keep it busy enough). Pick the home region carefully: it can't be changed later, and free
machines are sometimes "out of capacity" (try again later or another availability domain).

1. Sign up at https://www.oracle.com/cloud/free/ with **home region** India West (Mumbai), India South
   (Hyderabad) or Singapore.
2. Create a compute instance: image **Ubuntu 24.04**, shape **VM.Standard.A1.Flex** (1 OCPU, 6 GB is plenty),
   save the SSH key. In the instance's subnet security list, allow inbound TCP **80** and **443**.
3. Get a free name for it: at https://www.duckdns.org make `yourname.duckdns.org` pointing at the machine's
   public IP.
4. SSH in and install Node 24 and Caddy (the web server that gets the HTTPS certificate automatically):
   ```sh
   curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash - && sudo apt-get install -y nodejs git
   sudo apt-get install -y caddy   # see https://caddyserver.com/docs/install#debian-ubuntu-raspbian if not found
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
   sudo netfilter-persistent save
   ```
5. Get the code and build it:
   ```sh
   git clone https://github.com/TusharRajput07/drape.git && cd drape
   npm run install:ci && npm run build
   ```
6. Create `server/.env` with the same variables as the Render table, except: `PORT=4000`,
   `CLIENT_URL=https://yourname.duckdns.org`, and `TRUST_PROXY=loopback` (Caddy runs on the same machine).
   Then `npm run db:deploy`.
7. Run it as a service: create `/etc/systemd/system/drape.service`:
   ```ini
   [Unit]
   Description=Drape
   After=network.target

   [Service]
   WorkingDirectory=/home/ubuntu/drape
   ExecStart=/usr/bin/npm start
   Restart=always
   User=ubuntu

   [Install]
   WantedBy=multi-user.target
   ```
   then `sudo systemctl enable --now drape`.
8. Point Caddy at it: put this in `/etc/caddy/Caddyfile` and run `sudo systemctl reload caddy`:
   ```
   yourname.duckdns.org {
       reverse_proxy localhost:4000
   }
   ```
9. To update later: `cd drape && git pull && npm run install:ci && npm run build && npm run db:deploy && sudo systemctl restart drape`.

---

## After deploying: checklist

- [ ] Neon password and Cloudinary API secret changed (step 0) and the old Cloudinary key deleted.
- [ ] `TRUST_PROXY` set (`1` on Render, `loopback` behind Caddy on the same machine).
- [ ] `CLIENT_URL` is exactly the app's address, with `https://` and no trailing `/`.
- [ ] Open the address on a laptop: you can sign up / log in, reload and stay logged in.
- [ ] Check the headers: `curl -sI https://your-address/` shows `Cross-Origin-Opener-Policy: same-origin` and
      `Cross-Origin-Embedder-Policy: credentialless`; `curl -s https://your-address/api/v1/me` answers
      `{"success":false,"error":{"code":"UNAUTHENTICATED",…}}`.
- [ ] **On your phone**: open the address in Chrome (Android) → menu → **Install app** / **Add to Home
      screen**; on iPhone, Safari → Share → **Add to Home Screen**. Open it from the home-screen icon.
- [ ] Upload a piece with **Remove background** on (the first time downloads the remover, ~100 MB, once), make
      an outfit, add a wishlist link, check the weather card.
- [ ] Render only: the cron-job.org ping is running (its history shows successful calls every 10 minutes).

---

## Good to know

- **Clean-up jobs** run inside the production server: expired logins are removed daily, and photos that were
  uploaded but never saved (older than 24 hours) are removed from Cloudinary weekly, plus once a few minutes
  after each start. The photo clean-up compares Cloudinary with the server's database, so **one Cloudinary
  account belongs to one database**: don't point a second database (or the laptop running
  `npm --prefix server run job:uploads`) at the same Cloudinary account. As a safety net it only touches
  photos of accounts that exist in its database, and if far too many photos look unsaved it deletes nothing
  and prints an error in the logs instead.
- **Cloudinary Admin API limit**: the free plan allows **500 Admin API calls per hour**, shared by everyone
  using the app. Every saved photo uses one (the server checks the upload), and the weekly clean-up uses a
  few. Plenty for you and some friends; if Drape ever gets many users, the upload check needs changing first
  (02-backend.md §12).
- **Neon free** pauses the database after a few idle minutes; the first request afterwards takes about half a
  second longer. Nothing to do.
- Logs: the server only prints `API ready on …` at start and real errors. Render shows them under **Logs**;
  on Oracle, `journalctl -u drape -f`.
- Testing on the phone from the laptop (`npm run phone`) keeps working as before.
