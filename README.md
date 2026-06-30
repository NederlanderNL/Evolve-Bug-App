# Evolve Report Board — standalone version

This is a standalone version of your bug tracker. It runs as a normal website
(no Claude required), stores data in a real database, and your whole team can
use it at once from any browser.

It keeps everything the Claude artifact version had: priority sorting, status
tracking (Open / In progress / Fixed), per-bug and per-suggestion dev notes,
suggestion voting (thumbs up/down, switchable), the passcode-gated editing,
and the animated background. It still polls for updates every 4 seconds so
everyone sees changes without refreshing.

## Permissions

- **Viewing** the board never requires anything — anyone with the link can
  see bugs, suggestions, and notes.
- **Adding/editing bugs & suggestions** (status changes, dev notes, delete)
  requires the edit passcode (`EDIT_PASSCODE`).
- **Voting on suggestions** is open to anyone with the link — no name or
  passcode needed. Each browser can only vote once per suggestion (tracked
  locally), and clicking a vote again switches or retracts it.

## Preview it first (no setup required)

You can run this on your own computer and try it out before doing anything
with GitHub, Vercel, or Turso. It automatically uses a local file as its
database if it doesn't find Turso credentials, so there's nothing to
configure.

```bash
npm install
npm run dev
```

Then open `http://localhost:3000` in your browser. Click "Unlock to edit"
and use the passcode `EvolveBugReporter` (or whatever you set in
`.env.local` — see below) to try adding bugs, suggestions, and notes.

This local mode is just for previewing — the data only lives on your machine
and won't be shared with your team. Once you're happy with it, follow the
deployment steps below to put it on a real shared URL.

(If you want to set a custom passcode even for local preview, copy
`.env.example` to `.env.local` and set `EDIT_PASSCODE` there before running
`npm run dev`.)

## What you need to deploy for real (all free)

1. A [GitHub](https://github.com) account, to hold the code.
2. A [Vercel](https://vercel.com) account, to host the site (sign up with
   your GitHub account, it's one click).
3. A [Turso](https://turso.tech) account, for the database (SQLite-compatible,
   free tier is plenty for this).

## 1. Create the database

1. Sign up at [turso.tech](https://turso.tech) and install their CLI, or just
   use their web dashboard (Settings → Database → Create Database).
2. Create a new database, name it something like `evolve-bugs`.
3. From the dashboard, grab two values:
   - **Database URL** (starts with `libsql://...`)
   - **Auth Token** (click "Create Token")

You don't need to create any tables yourself — the app creates them
automatically the first time it runs.

## 2. Push this code to GitHub

From this folder:

```bash
git init
git add .
git commit -m "Evolve report board"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/evolve-bug-tracker.git
git push -u origin main
```

(Use your actual GitHub repo URL, not the placeholder above.)

## 3. Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import the GitHub repo
   you just created.
2. Before deploying, open the **Environment Variables** section and add:

   | Name | Value |
   |---|---|
   | `TURSO_DATABASE_URL` | the `libsql://...` URL from Turso |
   | `TURSO_AUTH_TOKEN` | the auth token from Turso |
   | `EDIT_PASSCODE` | whatever passcode your editor should use (e.g. `EvolveBugReporter`) |

3. Click **Deploy**. After a minute or two, Vercel gives you a live URL like
   `evolve-bug-tracker.vercel.app` — that's your standalone site.

That's it. Send that URL to your team. No Claude account, no published
artifact link, no download — just a website.

## Updating it later

```bash
git add .
git commit -m "describe your change"
git push
```

Vercel automatically redeploys on every push.

## Notes on the passcode and voting systems

The edit passcode is checked on the server for every add/edit/delete
request — it's not just hidden in the UI. Viewing the board never requires
it.

Voting is open to anyone with the link. Each suggestion remembers your
vote in your browser's local storage, so you can't double-vote from the
same browser, and clicking a vote again switches it (up↔down) or retracts
it. This isn't tied to an account, so clearing browser data or voting from
a different device would let someone vote again — fine for casual staff
use, not meant to be airtight.

If you ever want to rotate the passcode, change `EDIT_PASSCODE` in your
Vercel project settings and redeploy.
