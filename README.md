# Digital Record Logbook

A simple digital logbook: anyone can **view** entries (date, transaction, filed by),
but only an admin can **add, edit, or delete** entries. Data is stored in Postgres
and the app deploys to Vercel as static files + serverless API functions.

## Project structure

```
digital-logbook/
├── index.html          # the page
├── style.css           # styling
├── script.js           # frontend logic (view mode, login, CRUD calls)
├── api/
│   ├── login.js         # POST /api/login -> checks admin/password, returns a token
│   ├── records.js       # GET (public) / POST, PUT, DELETE (admin only) /api/records
│   ├── _db.js            # Postgres connection + auto-creates the table
│   └── _auth.js          # signs/verifies the admin session token
├── schema.sql            # reference SQL (table also auto-creates itself)
├── package.json
└── .env.example
```

## How the two modes work

- **View Only (default):** loads entries from `GET /api/records`, no login needed.
- **Admin Mode:** click "Admin Login", sign in, and the page unlocks the "New Entry"
  form plus edit/delete buttons on every row. The login issues a signed token
  (stored in the browser's `sessionStorage`) that's sent as a `Bearer` token on every
  write request. The API rejects any add/edit/delete call without a valid token.

The admin username/password are **not** stored in the database — they're checked
against environment variables on the server, so you can change them anytime without
touching code.

## 1. Set up Postgres

You have two easy options:

**Option A — Vercel Postgres (or the Neon/Supabase Marketplace integration)**
1. In your Vercel project, go to the **Storage** tab and create/connect a Postgres
   database.
2. Vercel automatically adds a `POSTGRES_URL` environment variable to your project —
   you don't need to do anything else.

**Option B — Any external Postgres (Neon, Supabase, Railway, your own server, etc.)**
1. Grab the connection string (looks like `postgres://user:password@host:5432/dbname`).
2. Add it to your Vercel project as the environment variable `DATABASE_URL`.

The `logbook_entries` table is created automatically the first time the API runs —
no manual migration needed (though `schema.sql` is there if you'd rather run it
yourself).

## 2. Set environment variables on Vercel

In **Project Settings → Environment Variables**, add:

| Variable             | Required | Notes                                                 |
|-----------------------|----------|--------------------------------------------------------|
| `POSTGRES_URL` or `DATABASE_URL` | Yes (one of them) | Your Postgres connection string |
| `ADMIN_USERNAME`      | Optional | Defaults to `admin` if not set                        |
| `ADMIN_PASSWORD`      | Recommended | Defaults to `adminpassword` — **change this**      |
| `ADMIN_TOKEN_SECRET`  | Recommended | Any long random string, used to sign login tokens  |

## 3. Deploy

From this folder:

```bash
npm install -g vercel   # if you don't already have the CLI
cd digital-logbook
vercel                  # follow the prompts to create/link a project
vercel --prod           # deploy to production
```

Or just drag the project into a new Vercel project from the dashboard, or push it
to a GitHub repo and import it in Vercel — either way, Vercel will detect the
`api/` folder automatically and serve `index.html`, `style.css`, and `script.js`
as static files.

## 4. Local development

```bash
npm install
cp .env.example .env    # fill in real values
vercel dev
```

Then open the local URL it prints (typically `http://localhost:3000`).

## Security notes (please read)

This was built to be simple, like a digital version of a paper logbook — it is
**not** hardened for sensitive data:

- There's a single shared admin account, not per-person logins. The "filed by"
  field is just typed in by whoever is logged in — it isn't independently verified.
- Change `ADMIN_PASSWORD` and `ADMIN_TOKEN_SECRET` from their defaults before
  sharing the link with anyone.
- The login token lives in `sessionStorage` and expires after 8 hours, but anyone
  with the admin password can log in from anywhere — there's no rate limiting or
  lockout.
- If you need real audit trails, per-user accounts, or stronger security, this is
  a good starting point but would need a proper auth system (e.g. NextAuth, Clerk,
  or a per-user Postgres-backed login table) layered on top.
