# Deploying Once Were Wild Travel (one-click, Docker, auto-HTTPS)

This repo ships a complete, hands-off Docker setup. After you have a Linux
server with Docker, the whole stack (frontend + backend + MongoDB + HTTPS
reverse proxy) comes up with **one command** and **automatic HTTPS**.

Best fit: a **VPS with root access** (Bluehost VPS, IONOS, DigitalOcean,
Hetzner, etc.), **>= 2 vCPU / >= 4 GB RAM**, Ubuntu 22.04/24.04.

---

## TL;DR - fastest path

```bash
# 1. Install Docker (one line)
curl -fsSL https://get.docker.com | sh

# 2. Clone your repo
git clone https://github.com/pinnacle467/oww.git && cd oww

# 3. (HTTPS only) put your domain in .env  - skip for an IP-only test
echo "SITE_ADDRESS=your-domain.com" >> .env

# 4. Launch. Secrets are auto-generated; the admin password is printed once.
chmod +x deploy.sh && ./deploy.sh
```

That's it. Visit `https://your-domain.com/` (or `http://<server-ip>/` if you
skipped step 3). Admin is at `/admin`.

`./deploy.sh` is safe to re-run any time. Other commands:
`./deploy.sh logs` | `./deploy.sh ps` | `./deploy.sh down` | `./deploy.sh rebuild`.

---

## What runs

| Service  | Role                                   | Port |
|----------|----------------------------------------|------|
| caddy    | Public entry + **automatic HTTPS**     | 80 / 443 |
| frontend | React build served by Express          | 3000 (internal) |
| backend  | FastAPI - all `/api` routes            | 8001 (internal) |
| mongo    | MongoDB 7 (skipped if you use Atlas)   | 27017 (internal) |

The browser only talks to Caddy. Caddy routes `/api/*` to the backend and
everything else to the frontend, so there are no CORS issues and the frontend
uses a relative `/api` base.

---

## Automatic HTTPS (zero certificate work)

Set one line in `.env`:

```
SITE_ADDRESS=your-domain.com
```

Then point the domain's **DNS A record** at your server's IP and run
`./deploy.sh`. Caddy automatically obtains and renews a free Let's Encrypt
certificate. No certbot, no manual cert files. Requires ports **80 and 443**
open on the server/firewall.

If `SITE_ADDRESS` is left as `:80`, the site is served over plain HTTP by IP
(fine for a first test).

---

## Option A - Cloudflare (easiest HTTPS, also adds a global CDN)

Great if your audience is far from the server (e.g. an Australian brand on a
US VPS). Two ways:

**A1. Cloudflare "Flexible" (no server cert needed):**
1. Add your domain to Cloudflare, set the DNS A record (Proxied / orange cloud)
   to your server IP.
2. Keep `SITE_ADDRESS=:80` in `.env` (Caddy serves HTTP; Cloudflare adds HTTPS
   at its edge).
3. In Cloudflare: SSL/TLS -> Overview -> **Flexible**.
4. `./deploy.sh`. Visitors get `https://your-domain.com` via Cloudflare.

**A2. Cloudflare "Full" (end-to-end encryption):**
1. Set `SITE_ADDRESS=your-domain.com` so Caddy gets a real cert.
2. DNS A record Proxied to your server IP.
3. Cloudflare SSL/TLS mode -> **Full**.
4. `./deploy.sh`.

Cloudflare also gives you free CDN caching, DDoS protection and faster global
load times - recommended for production.

---

## Option B - MongoDB Atlas (managed database, run on a smaller VPS)

Using Atlas means you don't run a database on your server (less RAM, automatic
backups). The bundled `mongo` container is skipped automatically.

1. Create a free cluster at https://www.mongodb.com/atlas
2. Create a DB user and copy your **SRV connection string**.
3. Atlas -> Network Access -> add your server's IP (or `0.0.0.0/0` to allow all
   while testing).
4. In `.env` set:
   ```
   MONGO_URL=mongodb+srv://USER:PASS@cluster0.xxxx.mongodb.net/?retryWrites=true&w=majority
   DB_NAME=oncewerewild
   ```
5. `./deploy.sh` - it detects the Atlas URI and does NOT start the local Mongo
   container.

(To go back to a local DB, set `MONGO_URL=mongodb://mongo:27017` and re-run.)

---

## Data persistence (this is what was missing in the preview)

- **Database**: the local Mongo container stores data in the `mongo_data`
  Docker volume - survives restarts, rebuilds and reboots. (Atlas persists in
  the cloud.)
- **Uploaded images/videos**: stored on the host via the `./backend/uploads`
  bind mount - survives everything. Back it up by copying that folder.

A server reboot will **not** wipe your gallery or content.

Backups:
```bash
# database (local mongo)
docker compose --profile localdb exec mongo mongodump --archive=/data/db/backup.archive
# uploads
tar czf uploads-backup.tgz backend/uploads
```

---

## Admin login

- URL: `https://your-domain.com/admin`
- Email: value of `ADMIN_EMAIL` in `.env`
- Password: auto-generated on first deploy and **printed once** by `deploy.sh`
  (also saved in `.env` as `ADMIN_PASSWORD`). Set your own by editing `.env`
  before the first run.

---

## Updating after you push new code

```bash
git pull
./deploy.sh        # rebuilds changed images and restarts
```

---

## Fully-managed alternative (no server to manage)

If you'd rather not run a VPS at all, the same Docker images deploy on PaaS
hosts that build straight from GitHub - e.g. **Render** or **Railway** for the
frontend + backend, paired with **MongoDB Atlas** for the database. You connect
the GitHub repo, set the same environment variables from `.env.example`, and
they build and host it for you. (A VPS via the steps above gives you the
lowest cost and full control.)

---

## Notes

- `REACT_APP_BACKEND_URL` is baked into the React bundle at **build time**.
  Leave it empty (default) for same-origin `/api` via Caddy.
- The hero `<link rel=preload>` LCP micro-optimisation the backend writes into
  `index.html` is a no-op in this split-container layout; the site is fully
  functional without it.
