import { NextResponse } from "next/server";
import { getDb, ensureSchema, getSyncState, setSyncState, uid } from "../../../lib/db";
import { getForumThreads, getThreadStarterMessage, snowflakeToDate } from "../../../lib/discord";
import { isDuplicate } from "../../../lib/dedupe";

const SYNC_KEY = "discord_bugs_last_sync";

export async function POST() {
  await ensureSchema();

  const botToken = process.env.DISCORD_BOT_TOKEN;
  const channelIds = (process.env.DISCORD_BUG_FORUM_CHANNEL_ID || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!botToken || channelIds.length === 0) {
    return NextResponse.json(
      { error: "Discord sync isn't configured (missing DISCORD_BOT_TOKEN or DISCORD_BUG_FORUM_CHANNEL_ID)." },
      { status: 400 }
    );
  }

  const db = getDb();

  let threads = [];
  try {
    for (const channelId of channelIds) {
      const channelThreads = await getForumThreads(channelId, guildId);
      threads.push(...channelThreads);
    }
  } catch (e) {
    return NextResponse.json({ error: `Couldn't reach Discord: ${e.message}` }, { status: 502 });
  }

  const lastSyncRaw = await getSyncState(SYNC_KEY);
  const lastSync = lastSyncRaw ? new Date(lastSyncRaw) : new Date(0);

  // Only threads created after the last sync, oldest first so imports land
  // in the order they were originally reported.
  const candidates = threads
    .map((t) => ({ thread: t, createdAt: snowflakeToDate(t.id) }))
    .filter((t) => t.createdAt > lastSync)
    .sort((a, b) => a.createdAt - b.createdAt);

  // Existing bugs, used both to skip already-imported threads and to check
  // for duplicate content from threads we haven't seen before.
  const existingRes = await db.execute("SELECT id, title, description, discordThreadId FROM bugs");
  const existingBugs = existingRes.rows;
  const alreadyImportedThreadIds = new Set(existingBugs.map((b) => b.discordThreadId).filter(Boolean));

  let imported = 0;
  let skippedDuplicate = 0;
  let skippedAlreadyImported = 0;
  let skippedNoContent = 0;
  let newestSeen = lastSync;

  for (const { thread, createdAt } of candidates) {
    if (createdAt > newestSeen) newestSeen = createdAt;

    if (alreadyImportedThreadIds.has(thread.id)) {
      skippedAlreadyImported++;
      continue;
    }

    const starter = await getThreadStarterMessage(thread.id);
    if (!starter) {
      skippedNoContent++;
      continue;
    }

    const candidate = {
      title: thread.name || "Untitled report",
      description: (starter.content || "").trim(),
    };

    if (isDuplicate(candidate, existingBugs)) {
      skippedDuplicate++;
      continue;
    }

    const bug = {
      id: uid(),
      title: candidate.title.slice(0, 200),
      description: candidate.description.slice(0, 4000),
      reporter: starter.author?.global_name || starter.author?.username || "Unknown",
      priority: "medium",
      status: "open",
      reportedAt: createdAt.toISOString(),
      notes: [],
      discordThreadId: thread.id,
    };

    await db.execute({
      sql: `INSERT INTO bugs (id, title, description, reporter, priority, status, reportedAt, notes, discordThreadId)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [bug.id, bug.title, bug.description, bug.reporter, bug.priority, bug.status, bug.reportedAt, JSON.stringify(bug.notes), bug.discordThreadId],
    });

    // Treat it as "existing" for the rest of this run too, so two near-
    // identical reports in the same sync batch don't both get imported.
    existingBugs.push(bug);
    imported++;
  }

  await setSyncState(SYNC_KEY, newestSeen.toISOString());

  return NextResponse.json({
    imported,
    skippedDuplicate,
    skippedAlreadyImported,
    skippedNoContent,
    checked: candidates.length,
  });
}
