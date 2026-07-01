import { getDb, ensureSchema, getSyncState, setSyncState, uid } from "./db";
import { getForumThreads, getThreadStarterMessage, snowflakeToDate } from "./discord";
import { findDuplicate } from "./dedupe";

// Used only when Discord isn't configured yet, so you can see how the
// triage panel behaves before setting up the real bot. Each one has a
// stable fake "thread ID" so clicking sync again won't add duplicates —
// once real DISCORD_BOT_TOKEN/channel env vars are set, this is skipped
// entirely in favor of actually talking to Discord.
const TEST_SAMPLES = {
  bugs: [
    { title: "Fire spell clips through prayer shield", description: "Reported in-game — the animation overlaps oddly when blocking with Protect from Magic." },
    { title: "Bank interface freezes on rapid withdraw-all", description: "Happens after spamming the withdraw-all button a few times in a row." },
    { title: "Slayer task counter not decrementing", description: "Killed 4 of the assigned monster but the counter still shows the original amount." },
  ],
  suggestions: [
    { title: "Add a slayer task reroll option", description: "Would help reduce frustration with bad task assignments." },
    { title: "Bigger bank space for ironman accounts", description: "Several players have mentioned running out of bank space earlier than expected." },
  ],
};

async function insertTestSamples(table, db) {
  const existingRes = await db.execute(`SELECT discordThreadId FROM ${table}`);
  const already = new Set(existingRes.rows.map((r) => r.discordThreadId).filter(Boolean));

  let imported = 0;
  const samples = TEST_SAMPLES[table] || [];
  for (let i = 0; i < samples.length; i++) {
    const fakeThreadId = `test-${table}-${i}`;
    if (already.has(fakeThreadId)) continue;
    const item = {
      id: uid(),
      title: samples[i].title,
      description: samples[i].description,
      reporter: "Test Player",
      priority: "unsorted",
      status: "open",
      reportedAt: new Date().toISOString(),
      notes: [],
      discordThreadId: fakeThreadId,
    };
    await db.execute({
      sql: `INSERT INTO ${table} (id, title, description, reporter, priority, status, reportedAt, notes, discordThreadId)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [item.id, item.title, item.description, item.reporter, item.priority, item.status, item.reportedAt, JSON.stringify(item.notes), item.discordThreadId],
    });
    imported++;
  }

  return { imported, skippedDuplicate: 0, skippedAlreadyImported: samples.length - imported, skippedNoContent: 0, checked: samples.length, testMode: true };
}

// Drains the staging queue for the given type (bugs/suggestions), running
// duplicate detection against the real table before promoting each item.
async function drainStagingQueue(table, db) {
  const staged = await db.execute({
    sql: "SELECT * FROM discord_staging WHERE type = ? ORDER BY receivedAt ASC",
    args: [table],
  });

  if (staged.rows.length === 0) return null; // nothing staged — fall through to bot/test

  const existingRes = await db.execute(`SELECT id, title, description, discordThreadId FROM ${table}`);
  const existingItems = existingRes.rows;
  const alreadyImportedThreadIds = new Set(existingItems.map((b) => b.discordThreadId).filter(Boolean));

  let imported = 0;
  let skippedDuplicate = 0;
  let skippedAlreadyImported = 0;

  for (const row of staged.rows) {
    // Always remove from staging whether we import it or not.
    await db.execute({ sql: "DELETE FROM discord_staging WHERE id = ?", args: [row.id] });

    if (alreadyImportedThreadIds.has(row.discordThreadId)) {
      skippedAlreadyImported++;
      continue;
    }

    const candidate = { title: row.title, description: row.description };
    if (findDuplicate(candidate, existingItems)) {
      skippedDuplicate++;
      continue;
    }

    const item = {
      id: uid(),
      title: row.title,
      description: row.description,
      reporter: row.reporter,
      priority: "unsorted",
      status: "open",
      reportedAt: row.receivedAt,
      notes: [],
      discordThreadId: row.discordThreadId,
    };

    await db.execute({
      sql: `INSERT INTO ${table} (id, title, description, reporter, priority, status, reportedAt, notes, discordThreadId)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [item.id, item.title, item.description, item.reporter, item.priority, item.status, item.reportedAt, JSON.stringify(item.notes), item.discordThreadId],
    });

    existingItems.push(item);
    imported++;
  }

  return {
    imported,
    skippedDuplicate,
    skippedAlreadyImported,
    skippedNoContent: 0,
    checked: staged.rows.length,
    source: "webhook",
  };
}

// table must be a hardcoded safe value ("bugs" or "suggestions"), never
// user input — it's interpolated directly into SQL.
export async function runDiscordSync({ table, channelEnvVar, syncKey, missingConfigLabel }) {
  await ensureSchema();

  const db = getDb();

  // Webhook staging takes priority — if there's anything queued up from
  // Discord webhooks, drain that first. This is what runs once webhooks
  // are configured, regardless of whether the bot is also set up.
  const stagingResult = await drainStagingQueue(table, db);
  if (stagingResult !== null) return stagingResult;

  // No staged items — fall back to the bot (if configured) or test data.
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const channelIds = (process.env[channelEnvVar] || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!botToken || channelIds.length === 0) {
    return insertTestSamples(table, db);
  }
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

    if (findDuplicate(candidate, existingItems)) {
      skippedDuplicate++;
      continue;
    }

    const item = {
      id: uid(),
      title: candidate.title.slice(0, 200),
      description: candidate.description.slice(0, 4000),
      reporter: starter.author?.global_name || starter.author?.username || "Unknown",
      priority: "unsorted",
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
