import { NextResponse } from "next/server";
import { getDb, ensureSchema, setSyncState } from "../../../lib/db";

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
const CLEANUP_KEY = "last_cleanup";

export async function POST() {
  await ensureSchema();
  const db = getDb();
  const cutoff = new Date(Date.now() - TWO_WEEKS_MS).toISOString();

  const res = await db.execute({
    sql: `DELETE FROM bugs WHERE status = 'fixed' AND reportedAt < ?`,
    args: [cutoff],
  });
  const res2 = await db.execute({
    sql: `DELETE FROM suggestions WHERE status = 'fixed' AND reportedAt < ?`,
    args: [cutoff],
  });

  await setSyncState(CLEANUP_KEY, new Date().toISOString());

  return NextResponse.json({
    deletedBugs: res.rowsAffected ?? 0,
    deletedSuggestions: res2.rowsAffected ?? 0,
    nextCleanup: new Date(Date.now() + TWO_WEEKS_MS).toISOString(),
  });
}

export async function GET() {
  await ensureSchema();
  const db = getDb();
  const res = await db.execute({
    sql: `SELECT value FROM sync_state WHERE key = ?`,
    args: [CLEANUP_KEY],
  });
  const lastCleanup = res.rows.length ? new Date(res.rows[0].value) : null;
  const nextCleanup = lastCleanup
    ? new Date(lastCleanup.getTime() + TWO_WEEKS_MS)
    : new Date(Date.now() + TWO_WEEKS_MS);
  return NextResponse.json({ lastCleanup: lastCleanup?.toISOString() ?? null, nextCleanup: nextCleanup.toISOString() });
}
