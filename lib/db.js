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

  initialized = true;
}

export function checkPasscode(req) {
  const provided = req.headers.get("x-edit-passcode") || "";
  const expected = process.env.EDIT_PASSCODE || "EvolveBugReporter";
  return provided === expected;
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
