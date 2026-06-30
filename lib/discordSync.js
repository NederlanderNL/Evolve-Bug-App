import { getDb, ensureSchema, getSyncState, setSyncState, uid } from "./db";
import { getForumThreads, getThreadStarterMessage, snowflakeToDate } from "./discord";
import { isDuplicate } from "./dedupe";

// table must be a hardcoded safe value ("bugs" or "suggestions"), never
// user input — it's interpolated directly into SQL.
export async function runDiscordSync({ table, channelEnvVar, syncKey, missingConfigLabel }) {
  await ensureSchema();

  const botToken = process.env.DISCORD_BOT_TOKEN;
  const channelIds = (process.env[channelEnvVar] || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!botToken || channelIds.length === 0) {
    return { error: `Discord sync isn't configured (missing DISCORD_BOT_TOKEN or ${missingConfigLabel}).`, status: 400 };
  }

  const db = getDb();

  let threads = [];
  try {
    for (const channelId of channelIds) {
      const channelThreads = await getForumThreads(channelId, guildId);
      threads.push(...channelThreads);
    }
  } catch (e) {
    return { error: `Couldn't reach Discord: ${e.message}`, status: 502 };
  }

  const lastSyncRaw = await getSyncState(syncKey);
  const lastSync = lastSyncRaw ? new Date(lastSyncRaw) : new Date(0);

  // Only threads created after the last sync, oldest first so imports land
  // in the order they were originally posted.
  const candidates = threads
    .map((t) => ({ thread: t, createdAt: snowflakeToDate(t.id) }))
    .filter((t) => t.createdAt > lastSync)
    .sort((a, b) => a.createdAt - b.createdAt);

  // Existing entries, used both to skip already-imported threads and to
  // check for duplicate content from threads we haven't seen before.
  const existingRes = await db.execute(`SELECT id, title, description, discordThreadId FROM ${table}`);
  const existingItems = existingRes.rows;
  const alreadyImportedThreadIds = new Set(existingItems.map((b) => b.discordThreadId).filter(Boolean));

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

    if (isDuplicate(candidate, existingItems)) {
      skippedDuplicate++;
      continue;
    }

    const item = {
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
      sql: `INSERT INTO ${table} (id, title, description, reporter, priority, status, reportedAt, notes, discordThreadId)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [item.id, item.title, item.description, item.reporter, item.priority, item.status, item.reportedAt, JSON.stringify(item.notes), item.discordThreadId],
    });

    // Treat it as "existing" for the rest of this run too, so two near-
    // identical reports in the same sync batch don't both get imported.
    existingItems.push(item);
    imported++;
  }

  await setSyncState(syncKey, newestSeen.toISOString());

  return {
    imported,
    skippedDuplicate,
    skippedAlreadyImported,
    skippedNoContent,
    checked: candidates.length,
  };
}
