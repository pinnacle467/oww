# Bluehost deploy — quick reference

This file documents how content (images, captions, settings) survives a
`git push` → `git pull` on the Bluehost VPS.

## How content survives a deploy

MongoDB is NOT in git. The uploaded image files in `backend/uploads/` ARE
in git. The bridge between them is the snapshot file:

```
backend/seed_data/site_snapshot.json
```

The backend re-writes this file (debounced ~2 s) every time the admin makes
a change (add/replace/delete media, edit text, rename a category, etc.).
On a fresh deploy (when the DB is empty), the backend seeds itself from
this snapshot instead of the bundled stock images.

### Your workflow after editing in admin

1. Make all your changes in `/admin` (images, text, settings).
2. Wait ~3 seconds (the snapshot saves automatically). Or click
   `Save snapshot now` if you want to force it (POST `/api/admin/snapshot/save`).
3. Push to GitHub (use the Save-to-GitHub button in the Emergent UI, or
   `git add . && git commit && git push` locally).
4. On Bluehost:
   ```bash
   git pull
   ./deploy.sh        # rebuilds + restarts; preserves the existing DB
   ```

### What if I want to "reset" Bluehost to match my local state exactly?

If the DB on Bluehost has drifted from the snapshot and you want to force
a re-seed from the snapshot, stop the stack, wipe the mongo volume, then
deploy again:

```bash
./deploy.sh down
docker volume rm oww_mongo_data    # or whatever the volume is named
./deploy.sh
```

The backend will see an empty DB, find `seed_data/site_snapshot.json`, and
seed from it. Result: Bluehost is now byte-for-byte identical to the
snapshot you pushed.

## Admin login on Bluehost

The admin password is set in `.env` (`ADMIN_PASSWORD=`). On the very first
run, `deploy.sh` auto-generates a strong random password and PRINTS IT
ONCE on the console. If you missed it, open `.env` on the server:

```bash
grep ADMIN_PASSWORD /app/.env
```

### "Something went wrong" on login — checklist

1. The email/password you're typing matches `.env`:
   ```bash
   grep -E '^ADMIN_(EMAIL|PASSWORD)=' .env
   ```
2. The admin user exists in Mongo (auto-seeded on first backend start):
   ```bash
   docker compose exec backend python -c "import os, asyncio; from motor.motor_asyncio import AsyncIOMotorClient; \
     c=AsyncIOMotorClient(os.environ['MONGO_URL']); print(asyncio.run(c[os.environ['DB_NAME']].users.find_one({'email': os.environ['ADMIN_EMAIL'].lower()}, {'_id':0,'password_hash':0})))"
   ```
3. Backend is reachable from the frontend (same origin via Caddy in this
   stack): open `https://your-domain/api/` — should return `{"message":"API ready"}`.
4. JWT_SECRET is set and is the SAME across restarts (otherwise old
   sessions become invalid but new logins should still work):
   ```bash
   grep JWT_SECRET .env
   ```
5. Tail backend logs while attempting login:
   ```bash
   ./deploy.sh logs   # then try the login
   ```
   Look for `INFO:     ... POST /api/auth/login HTTP/1.1 4xx/5xx` and the
   matching python traceback.
