# Deploying Haajari

One Render web service serves the API **and** the app from the same HTTPS address, backed by a free
MongoDB Atlas database. One address matters: browsers only allow the offline app (service worker) and
phone notifications on a secure origin, and keeping the app and API together avoids cross-site setup.

Time needed: about 20 minutes. Cost: free tiers of both services (check their current pricing pages).

## 1. Database: MongoDB Atlas

1. Sign in at https://cloud.mongodb.com and create a **free cluster**. Pick the **Mumbai (ap-south-1)** region.
2. **Database Access** → add a user with a password (letters and digits only, to avoid URL escaping).
3. **Network Access** → add `0.0.0.0/0` (Render's free plan has no fixed IP address).
4. **Connect → Drivers** → copy the connection string and add the database name `haajari` before the `?`:
   ```
   mongodb+srv://haajari:<password>@cluster0.xxxxx.mongodb.net/haajari?retryWrites=true&w=majority
   ```

## 2. App: Render

1. Push this repository to GitHub (`git push -u origin main`).
2. Sign in at https://render.com with GitHub → **New → Blueprint** → choose the `haajari` repository.
   Render reads `render.yaml` and asks for one value: paste the Atlas string as `MONGO_URI`.
3. **Apply**. The first build takes about 5 minutes. The service opens at `https://haajari.onrender.com`
   (or the name Render gives it; if it differs, set `CLIENT_ORIGIN` to that address in the service's Environment tab).
4. On first start the server finds an empty database and loads the demo school (`SEED_ON_EMPTY=true`).
   Log in with the demo accounts in the README.

Check it: `https://<your-address>/api/health` should answer `{"ok":true,...}`.

## 3. Phones

- Open the address in Chrome on Android → menu → **Add to Home screen**. It now opens like an app and works offline.
- Notifications work here (HTTPS). Parents tap **Turn on alerts** on their home screen.

## Before a demo or viva

- The free Render plan **sleeps after about 15 minutes without visitors**; the first request then takes up to a
  minute. Open the site 2–3 minutes before you present.
- To reset the demo data: in Atlas, **Browse Collections → drop the `haajari` database**, then restart the Render
  service (Manual Deploy → Restart). It reseeds itself.
- Or from your computer: `set MONGO_URI=<atlas string>` then `npm run seed`.

## Settings reference

| Variable | Meaning |
| --- | --- |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Long random string for signing logins (Render generates one) |
| `NODE_ENV` | `production` |
| `OTP_MODE` | `dev` shows the OTP on screen (demo). For a real school connect an SMS provider in `server/src/routes/auth.js` |
| `SEED_ON_EMPTY` | `true` loads the demo school on an empty database. Set `false` for a real school |
| `CLIENT_ORIGIN` | The site's own address (CORS) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Notification keys. If empty they are created on start, but Render's disk is wiped on each deploy, so phones would need to turn alerts on again; generate once with `npx web-push generate-vapid-keys` and set both |
| `SERVE_CLIENT` | `false` to run the API alone (if you host the app elsewhere) |

## For a real school (beyond the demo)

1. `SEED_ON_EMPTY=false`, empty database, then create the headmaster account (run `npm run seed` once and change
   the password, or add an admin with a short script).
2. Import the register from a spreadsheet (Students → Import).
3. Connect an SMS provider for OTPs and set `OTP_MODE=sms`.
4. Set the VAPID keys so notifications survive redeploys.
5. Move to a paid Render instance (no sleeping) before teachers depend on it at 9 a.m.

## Why not Vercel + Render (the original plan)

That splits the app and the API across two domains. It works, but needs CORS, a proxy for `/api`, and the
service worker and notifications then belong to the app's domain while data lives on the other. One service
is simpler to run and to explain, and is what the load and field tests were run against.
