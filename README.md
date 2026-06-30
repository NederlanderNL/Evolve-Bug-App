# Evolve Report Board — standalone version

A standalone bug & suggestion tracker for your staff team. No Claude
required — it's a real website with its own database, Discord login, and
role-based permissions.

Features: priority sorting, status tracking (Open / In progress / Fixed),
per-bug and per-suggestion dev notes, suggestion voting (thumbs up/down,
switchable), the animated background, and now — Discord sign-in with five
staff roles (Helper, Community Manager, Moderator, Admin, Owner).

## Permissions

- **Signing in** requires a Discord account. Anyone can sign in; they start
  as **Helper** by default.
- **Adding/editing bugs & suggestions** (status changes, dev notes, delete)
  is restricted to **Community Manager, Admin, and Owner**.
- **Voting on suggestions** is open to everyone signed in, all 5 roles.
- **Assigning roles** can only be done by an **Owner**, from the "Manage
  Roles" tab (only Owners see this tab). The first Owner(s) are set via an
  environment variable (see below) — after that, Owners can promote/demote
  anyone from the Roles tab.

## What you need (all free)

1. A [Discord Developer](https://discord.com/developers/applications)
   account — to create the login app.
2. A [GitHub](https://github.com) account, to hold the code.
3. A [Vercel](https://vercel.com) account, to host the site.
4. A [Turso](https://turso.tech) account, for the database.

## 1. Create a Discord OAuth app

1. Go to <https://discord.com/developers/applications> and click
   **New Application**. Name it something like "Evolve Report Board".
2. In the left sidebar, click **OAuth2**. Copy the **Client ID** and
   **Client Secret** — you'll need both shortly.
3. Still on the OAuth2 page, under **Redirects**, add:
   - `http://localhost:3000/api/auth/callback/discord` (for local preview)
   - `https://YOUR-VERCEL-DOMAIN.vercel.app/api/auth/callback/discord`
     (you can add this once you know your Vercel URL — see step 4)

## 2. Find your Discord user ID (to become the first Owner)

1. In Discord, go to **Settings → Advanced** and turn on **Developer Mode**.
2. Right-click your own profile picture/name anywhere in Discord and choose
   **Copy User ID**. That's a long number — save it.
3. You'll put this in the `OWNER_DISCORD_IDS` environment variable below.
   You can list multiple people's IDs separated by commas if more than one
   person should start as Owner.

## 3. Preview it locally (optional, but recommended)

Even local preview needs real Discord credentials now, since login goes
through Discord's servers. It still uses a local file as the database
automatically (no Turso needed yet).

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local` and fill in:
- `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` (from step 1)
- `NEXTAUTH_SECRET` — generate one with `openssl rand -base64 32`, or any
  long random string
- `OWNER_DISCORD_IDS` — your Discord user ID from step 2

Leave `TURSO_DATABASE_URL` blank for local preview. Then:

```bash
npm run dev
```

Open `http://localhost:3000`, click "Sign in with Discord," and you should
land back on the board as an Owner (since your ID is in
`OWNER_DISCORD_IDS`). Try adding a bug, a suggestion, voting, and check the
"Manage Roles" tab.

## 4. Create the production database

1. Sign up at [turso.tech](https://turso.tech), create a database (e.g.
   `evolve-bugs`).
2. From the dashboard grab the **Database URL** (`libsql://...`) and an
   **Auth Token**.

## 5. Push this code to GitHub

```bash
git init
git add .
git commit -m "Evolve report board"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/evolve-bug-tracker.git
git push -u origin main
```

## 6. Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new), import the repo.
2. Before deploying, add these **Environment Variables**:

   | Name | Value |
   |---|---|
   | `TURSO_DATABASE_URL` | from step 4 |
   | `TURSO_AUTH_TOKEN` | from step 4 |
   | `DISCORD_CLIENT_ID` | from step 1 |
   | `DISCORD_CLIENT_SECRET` | from step 1 |
   | `NEXTAUTH_SECRET` | same random string as local, or a new one |
   | `OWNER_DISCORD_IDS` | your Discord user ID(s) from step 2 |

3. Click **Deploy**. Once it's live, copy the URL Vercel gives you (e.g.
   `evolve-bug-tracker.vercel.app`).
4. Go back to your Discord app's OAuth2 page and add a second redirect URL:
   `https://evolve-bug-tracker.vercel.app/api/auth/callback/discord`
   (using your actual domain).

That's it — share the Vercel URL with your team. Anyone can sign in and
view; only Community Manager+ can edit; only Owners can manage roles.

## Updating it later

```bash
git add .
git commit -m "describe your change"
git push
```

Vercel redeploys automatically on every push.

## Promoting/demoting staff

Sign in as an Owner, open the **Manage Roles** tab, and pick a new role
from the dropdown next to each person's name. Changes take effect within a
few seconds (no need for them to sign out).

## A note on security

Roles are stored server-side and checked on every request — a person can't
fake a higher role by editing anything in their browser. The only "soft
spot" is the very first Owner(s): whoever controls `OWNER_DISCORD_IDS` in
your Vercel project settings can always make themselves (or anyone) an
Owner, so treat access to your Vercel project and Discord app as sensitive.
