# Evolve Report Board — standalone version

This is a standalone version of your bug tracker. It runs as a normal website
(no Claude required), stores data in a real database, and your whole team can
use it at once from any browser.

It keeps everything the Claude artifact version had: priority sorting, status
tracking (Open / In progress / Fixed), per-bug dev notes, the passcode-gated
editing, and the animated background. It still polls for updates every 4
seconds so everyone sees changes without refreshing.

## What you need (all free)

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

You don't need to create any tables yourself — the app creates the `bugs`
table automatically the first time it runs.

## 2. Push this code to GitHub

From this folder:

```bash
git init
git add .
git commit -m "Evolve report board"
```

Then create a new empty repository on GitHub and follow the push instructions
it gives you (`git remote add origin ...`, `git push -u origin main`).

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

Whenever you want to change anything (colors, new features, etc.), just edit
the files and push to GitHub again:

```bash
git add .
git commit -m "describe your change"
git push
```

Vercel automatically redeploys on every push.

## Running it locally first (optional)

If you want to test it on your own machine before deploying:

```bash
npm install
cp .env.example .env.local
# edit .env.local and fill in your Turso URL/token and passcode
npm run dev
```

Then open `http://localhost:3000`.

## Notes on the passcode system

Unlike the Claude artifact version, the passcode is now actually enforced on
the server — every add/edit/delete request is checked against
`EDIT_PASSCODE` before it's allowed to touch the database. Viewing the board
never requires a passcode; only mutating it does.

If you ever want to rotate the passcode, just change the `EDIT_PASSCODE`
environment variable in your Vercel project settings and redeploy (Vercel
redeploys automatically when you save env var changes, or you can trigger a
manual redeploy from the dashboard).
