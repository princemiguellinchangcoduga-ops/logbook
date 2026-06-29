# Digital Record Logbook

A simple digital logbook for tracking document requests: anyone can **view** and
**search** entries, but only an admin can **add, edit, or delete** them. Data is
stored in Postgres and the app deploys to Vercel as static files + serverless API
functions.

## Fields

Each entry has: **Date & Time**, **Name**, **Control Number**, **Course**,
**Documents Released**, **Purpose**, **Receipt Number**, and **Amount**
(a number, stored to 2 decimal places).

## Project structure

```
digital-logbook/
├── index.html          # the page
├── style.css            # styling
├── script.js            # frontend logic (view mode, login, search, pagination, CRUD)
├── api/
│   ├── login.js          # POST /api/login -> checks admin/password, returns a token
│   ├── records.js        # GET (public, search+paginated) / POST, PUT, DELETE (admin only)
│   ├── _db.js              # Postgres connection, auto-migrating table, storage-size check
│   └── _auth.js            # signs/verifies the admin session token
├── schema.sql              # reference SQL (table also auto-creates/auto-migrates itself)
├── package.json
└── .env.example
```

## How it works

- **View Only (default):** loads entries from `GET /api/records`, paginated 15 at a
  time with Prev / page-number / Next controls at the bottom — no endless scrolling.
- **Search:** the search box filters across all fields (name, transaction no.,
  document type, purpose, control no.) and re-paginates the results.
- **Admin Mode:** click "Admin Login," sign in, and the page unlocks the "New Entry"
  form, edit/delete buttons, and the "Export to Excel" button. Login issues a signed
  token (stored in the browser's `sessionStorage`) sent as a `Bearer` token on every
  write request — the API rejects any add/edit/delete call without a valid token.
- **Storage warning:** every load checks how close your database is to its storage
  limit (`pg_database_size`) and shows a banner at 75% and a stronger one at 90%.
  Defaults to a 500 MB limit; override with the `STORAGE_LIMIT_MB` env var if yours
  differs.
- **Export to Excel:** downloads an `.xlsx` of all matching entries (not just the
  current page), built client-side — no server load beyond the normal search query.

The admin username/password are **not** stored in the database — they're checked
against environment variables on the server, so you can change them anytime without
touching code.

## 1. Set up Postgres

You have two easy options:

**Option A — Vercel Postgres (or the Neon/Prisma/Supabase Marketplace integration)**
1. In your Vercel project, go to the **Storage** tab and create/connect a Postgres
   database.
2. When connecting, set the custom environment variable prefix to `DATABASE` so it
   creates `DATABASE_URL` (the variable this app looks for).

**Option B — Any external Postgres (Neon, Supabase, Railway, your own server, etc.)**
1. Grab the connection string (looks like `postgres://user:password@host:5432/dbname`).
2. Add it to your Vercel project as the environment variable `DATABASE_URL`.

The table (and any schema upgrades) are applied automatically the first time the API
runs after a deploy — no manual migration needed (though `schema.sql` is there if
you'd rather run it yourself).

## 2. Set environment variables on Vercel

In **Project → Settings → Environments → (pick an environment) → Environment
Variables**, add:

| Variable             | Required | Notes                                                 |
|-----------------------|----------|--------------------------------------------------------|
| `DATABASE_URL` (or `POSTGRES_URL`) | Yes | Your Postgres connection string |
| `ADMIN_USERNAME`      | Optional | Defaults to `admin` if not set                        |
| `ADMIN_PASSWORD`      | Recommended | Defaults to `adminpassword` — **change this**      |
| `ADMIN_TOKEN_SECRET`  | Recommended | Any long random string, used to sign login tokens  |
| `STORAGE_LIMIT_MB`    | Optional | Defaults to `500` — set to match your actual database plan |

## 3. Deploy

```bash
git add .
git commit -m "Update logbook fields and add search/pagination/storage warning"
git push
```

Vercel auto-redeploys from your connected repo. New/changed environment variables
only apply to deployments made after they're saved — redeploy from the
**Deployments** tab if you just added or changed one.

## 4. Local development

```bash
npm install
cp .env.example .env    # fill in real values
vercel dev
```

## Security notes (please read)

This was built to be simple, like a digital version of a paper logbook — it is
**not** hardened for sensitive data:

- There's a single shared admin account, not per-person logins.
- Change `ADMIN_PASSWORD` and `ADMIN_TOKEN_SECRET` from their defaults before
  sharing the link with anyone.
- The login token lives in `sessionStorage` and expires after 8 hours, but anyone
  with the admin password can log in from anywhere — there's no rate limiting or
  lockout.
- Export pulls up to 2000 matching rows in one request. If your logbook grows well
  beyond that, the export limit (and the page-size cap in `api/records.js`) would
  need raising.

