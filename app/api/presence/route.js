import { NextResponse } from "next/server";
import { getDb, ensureSchema } from "../../../lib/db";

const TIMEOUT_MS = 90 * 1000;

export async function POST(req) {
  const { sessionId, username, currentTab } = await req.json();
  if (!sessionId || !username) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  await ensureSchema();
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO presence (sessionId, username, role, currentTab, lastSeen)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(sessionId) DO UPDATE SET
            username = excluded.username,
            currentTab = excluded.currentTab,
            lastSeen = excluded.lastSeen`,
    args: [sessionId, username, "staff", currentTab || "bugs", new Date().toISOString()],
  });
  return NextResponse.json({ ok: true });
}

export async function GET() {
  await ensureSchema();
  const db = getDb();
  const cutoff = new Date(Date.now() - TIMEOUT_MS).toISOString();
  await db.execute({ sql: "DELETE FROM presence WHERE lastSeen < ?", args: [cutoff] });
  const res = await db.execute("SELECT username, role, currentTab FROM presence ORDER BY username ASC");
  return NextResponse.json(res.rows);
}
