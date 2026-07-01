import { NextResponse } from "next/server";
import { getDb, ensureSchema, uid } from "../../../lib/db";

// Figures out which type (bugs/suggestions) this webhook is for by checking
// which env var's webhook URL matches the incoming request's token. Discord
// webhook URLs end in /webhooks/{id}/{token} — we extract the token and
// compare against each configured webhook URL.
function getTypeFromRequest(req) {
  const url = req.nextUrl || new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return null;

  // Check all numbered env vars for bugs and suggestions.
  for (let i = 1; i <= 10; i++) {
    const bugUrl = process.env[`DISCORD_BUG_WEBHOOK_URL_${i}`];
    if (bugUrl && bugUrl.includes(token)) return "bugs";
    const sugUrl = process.env[`DISCORD_SUGGESTION_WEBHOOK_URL_${i}`];
    if (sugUrl && sugUrl.includes(token)) return "suggestions";
  }
  return null;
}

export async function POST(req) {
  await ensureSchema();

  const type = getTypeFromRequest(req);
  if (!type) {
    return NextResponse.json({ error: "Unknown webhook source" }, { status: 403 });
  }

  const body = await req.json();

  // Discord sends different event types — we only care about new forum
  // thread creation (thread_created) or message creation (MESSAGE_CREATE
  // in a forum channel). Filter out anything else silently.
  const threadId = body.thread?.id || body.channel_id;
  const title = body.thread?.name || body.channel?.name || "Untitled report";
  const content = (body.content || body.message?.content || "").trim();
  const reporter =
    body.author?.global_name ||
    body.author?.username ||
    body.member?.nick ||
    "Unknown";

  if (!threadId) {
    return NextResponse.json({ ok: true }); // not a thread event, ignore
  }

  const db = getDb();

  // Don't stage the same thread twice.
  const existing = await db.execute({
    sql: "SELECT id FROM discord_staging WHERE discordThreadId = ?",
    args: [threadId],
  });
  if (existing.rows.length > 0) {
    return NextResponse.json({ ok: true });
  }

  // Also skip if it's already been imported into the real table.
  const alreadyImported = await db.execute({
    sql: `SELECT id FROM ${type} WHERE discordThreadId = ?`,
    args: [threadId],
  });
  if (alreadyImported.rows.length > 0) {
    return NextResponse.json({ ok: true });
  }

  await db.execute({
    sql: `INSERT INTO discord_staging (id, type, title, description, reporter, discordThreadId, receivedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [uid(), type, title.slice(0, 200), content.slice(0, 4000), reporter, threadId, new Date().toISOString()],
  });

  return NextResponse.json({ ok: true });
}
