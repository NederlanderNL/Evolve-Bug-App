import { createClient } from "@libsql/client";

let client;

export function getDb() {
  if (!client) {
    client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}

let initialized = false;

export async function ensureSchema() {
  if (initialized) return;
  const db = getDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS bugs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      reporter TEXT NOT NULL DEFAULT 'Unknown',
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'open',
      reportedAt TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '[]'
    )
  `);
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
