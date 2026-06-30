# Evolve Report Board — standalone version

This is a standalone version of your bug tracker. It runs as a normal website
(no Claude required), stores data in a real database, and your whole team can
use it at once from any browser.

It keeps everything the Claude artifact version had: priority sorting, status
tracking (Open / In progress / Fixed), per-bug and per-suggestion dev notes,
suggestion voting (thumbs up/down, switchable), and the animated background.
It still polls for updates every 4 seconds so everyone sees changes without
refreshing.

## Permissions

- **Viewing** the board never requires anything — anyone with the link can
  see bugs, suggestions, and notes.
- **Adding/editing bugs & suggestions** (status changes, dev notes, delete)
  is open to anyone with the link too — no login or passcode. (A proper
  login system is planned to be added later on the main website instead.)
- **Voting on suggestions** is open to anyone with the link. Each browser
  can only vote once per suggestion (tracked locally), and clicking a vote
  again switches it or retracts it.

## Preview it first (no setup required)

You can run this on your own computer and try it out before doing anything
with GitHub, Vercel, or Turso. It automatically uses a local file as its
database if it doesn't find Turso credentials, so there's nothing to
configure.

```bash
npm install
npm run dev
```

Then open `http://localhost:3000` in your browser and try adding bugs,
suggestions, and notes.

This local mode is just for previewing — the data only lives on your machine
and won't be shared with your team. Once you're happy with it, follow the
deployment steps below to put it on a real shared URL.

## Pulling bug reports and suggestions from Discord

If your bug reports and/or suggestions live in Discord Forum channels
(each report is its own thread/post), the **"Sync from Discord"** button
in the header pulls new posts straight in — it syncs whichever tab
(Bugs or Suggestions) you're currently looking at. They're independent —
each has its own forum channel(s) and its own "last synced" point, so
syncing one doesn't touch the other.

**Before you set up the real bot**, clicking "Sync from Discord" adds a
small set of fake sample bugs/suggestions instead, so you can try out the
triage panel right away. It won't keep adding duplicates if you click it
again — once you add real `DISCORD_BOT_TOKEN`/channel credentials (see
below), it automatically switches over to pulling real reports instead.

- Each forum thread becomes one bug or suggestion (title = thread name,
  description = the original post, reporter = the post's author).
- Only threads created **since that tab's last sync** are checked —
  clicking the button again won't re-scan everything.
- New posts are compared against your existing bugs/suggestions (within
  the same type — bugs only compare against bugs) using a simple
  text-similarity check. Anything that looks like a likely duplicate is
  **skipped automatically** rather than imported — it won't show up
  flagged anywhere, it's just left out, on the assumption the original
  report already covers it.
- Threads that were already imported (even from a previous deploy) are
  never imported twice.

### Setting it up

1. Go to <https://discord.com/developers/applications> and create a new
   application (or reuse one you already have) — name it something like
   "Evolve Sync Bot".
2. In the left sidebar, click **Bot**. Click **Reset Token** (or "Add Bot"
   if there isn't one yet) and copy the token — this is `DISCORD_BOT_TOKEN`.
   Keep this secret; anyone with it can act as your bot.
3. Still on the Bot page, you do **not** need to enable any Privileged
   Gateway Intents for this — the sync only reads via normal REST calls.
4. Invite the bot to your server: go to **OAuth2 → URL Generator**, check
   the **bot** scope, then under Bot Permissions check **View Channels**
   and **Read Message History**. Copy the generated URL, open it in your
   browser, and add the bot to your server.
5. Make sure the bot can actually see your bug-report and suggestion forum
   channels — if those channels have custom permission overwrites, you may
   need to explicitly allow the bot's role to view them.
6. In Discord, enable **Developer Mode** (Settings → Advanced) if you
   haven't already, then:
   - Right-click your bug-report forum channel → **Copy Channel ID** →
     this is `DISCORD_BUG_FORUM_CHANNEL_ID`. Multiple bug-report channels?
     List all the IDs separated by commas, e.g. `111111,222222`.
   - Right-click your suggestions forum channel → **Copy Channel ID** →
     this is `DISCORD_SUGGESTION_FORUM_CHANNEL_ID`. Same comma rule if you
     have more than one.
   - Right-click your server's icon → **Copy Server ID** → this is
     `DISCORD_GUILD_ID`.
7. Add these as environment variables on Vercel (and in `.env.local` if
   you want to test locally too), then redeploy. You only need to set
   `DISCORD_BUG_FORUM_CHANNEL_ID` and/or `DISCORD_SUGGESTION_FORUM_CHANNEL_ID`
   — if you only want one of the two sync buttons working, just leave the
   other channel variable unset (that button will show an error if clicked,
   but won't affect the rest of the site).

### A note on the duplicate detection

It's a simple word-overlap comparison between each new post's title and
description and every existing entry of that same type — not true
AI/semantic matching. It'll reliably catch reports that reuse a lot of the
same wording, but very short or vaguely-worded reports might slip through
as "new" even if they're really the same bug/suggestion, or in rare cases
a long report sharing a lot of common words with an unrelated one could
get skipped incorrectly. Worth spot-checking the board after a sync rather
than trusting it blindly.

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
   | `DISCORD_BOT_TOKEN` | (optional) only needed for the Discord sync feature — see below |
   | `DISCORD_BUG_FORUM_CHANNEL_ID` | (optional) only needed for the Discord sync feature |
   | `DISCORD_SUGGESTION_FORUM_CHANNEL_ID` | (optional) only needed for the Discord sync feature |
   | `DISCORD_GUILD_ID` | (optional) only needed for the Discord sync feature |

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

## A note on having no access control right now

Anyone with the link can add, edit, or delete bugs and suggestions — there's
no passcode or login at the moment. That's intentional for now since a real
login system is planned to be wired in later on your main website. Until
then, treat the link itself as the only thing keeping this private — don't
post it anywhere public.
