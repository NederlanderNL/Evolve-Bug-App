import { createClient } from "@libsql/client";

let client;

export function getDb() {
  if (!client) {
    if (process.env.TURSO_DATABASE_URL) {
      // Production / real deployment: use your Turso database.
      client = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
      });
    } else {
      // No Turso credentials set — fall back to a local SQLite file so you
      // can preview the app with `npm run dev` before setting up Turso.
      // This file is NOT suitable for production hosting on Vercel (its
      // filesystem is read-only/ephemeral) — set TURSO_DATABASE_URL before
      // deploying for real.
      client = createClient({ url: "file:local-preview.db" });
    }
  }
  return client;
}

let initialized = false;

export async function ensureSchema() {
  if (initialized) return;
  const db = getDb();
  const ddl = (table) => `
    CREATE TABLE IF NOT EXISTS ${table} (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      reporter TEXT NOT NULL DEFAULT 'Unknown',
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'open',
      reportedAt TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '[]'
    )
  `;
  await db.execute(ddl("bugs"));
  await db.execute(ddl("suggestions"));

  // Vote counts only apply to suggestions. Added via ALTER so this also
  // upgrades a suggestions table that already existed before voting was
  // added — SQLite/libSQL has no "ADD COLUMN IF NOT EXISTS", so we just
  // ignore the error if the column is already there.
  for (const col of ["upvotes", "downvotes"]) {
    try {
      await db.execute(`ALTER TABLE suggestions ADD COLUMN ${col} INTEGER NOT NULL DEFAULT 0`);
    } catch (e) {
      // column already exists — fine
    }
  }

  // Tracks which Discord forum thread an entry was imported from, so the
  // same thread is never imported twice even across syncs.
  for (const table of ["bugs", "suggestions"]) {
    try {
      await db.execute(`ALTER TABLE ${table} ADD COLUMN discordThreadId TEXT`);
    } catch (e) {
      // column already exists — fine
    }
  }

  // Tracks when an item was marked as fixed, so the 2-week auto-cleanup
  // is based on fix date rather than report date.
  for (const table of ["bugs", "suggestions"]) {
    try {
      await db.execute(`ALTER TABLE ${table} ADD COLUMN fixedAt TEXT`);
    } catch (e) {
      // column already exists — fine
    }
  }

  // Tiny key/value table used to remember when we last synced from Discord,
  // so each sync only looks at threads created after that point.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sync_state (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  // Staging queue for webhook-received Discord posts. Items land here first
  // and only move to bugs/suggestions when a staff member clicks
  // "Sync from Discord" — so new reports don't appear publicly until
  // someone has reviewed and approved the batch.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS discord_staging (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      reporter TEXT NOT NULL DEFAULT 'Unknown',
      discordThreadId TEXT,
      receivedAt TEXT NOT NULL
    )
  `);

  initialized = true;
}

export async function getSyncState(key) {
  const db = getDb();
  const res = await db.execute({ sql: "SELECT value FROM sync_state WHERE key = ?", args: [key] });
  return res.rows.length ? res.rows[0].value : null;
}

export async function setSyncState(key, value) {
  const db = getDb();
  await db.execute({
    sql: "INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    args: [key, value],
  });
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
