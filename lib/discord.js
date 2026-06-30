const API = "https://discord.com/api/v10";

function botHeaders() {
  return { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` };
}

async function discordGet(path) {
  const res = await fetch(`${API}${path}`, { headers: botHeaders(), cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Discord API ${path} failed: ${res.status} ${body}`);
  }
  return res.json();
}

// Returns every thread (forum post) belonging to the given forum channel,
// combining currently-active threads and archived ones. Each thread has
// `id`, `name`, and a creation timestamp we can compare against the last
// sync time.
export async function getForumThreads(channelId, guildId) {
  const threads = [];

  // Active threads live under the guild, not the channel, and need filtering.
  if (guildId) {
    const active = await discordGet(`/guilds/${guildId}/threads/active`);
    for (const t of active.threads || []) {
      if (t.parent_id === channelId) threads.push(t);
    }
  }

  // Archived (closed/resolved) forum posts, paginated.
  let before;
  for (let page = 0; page < 20; page++) {
    const qs = before ? `?before=${before}&limit=100` : `?limit=100`;
    const archived = await discordGet(`/channels/${channelId}/threads/archived/public${qs}`);
    for (const t of archived.threads || []) threads.push(t);
    if (!archived.has_more || !archived.threads?.length) break;
    before = archived.threads[archived.threads.length - 1].thread_metadata?.archive_timestamp;
    if (!before) break;
  }

  // De-dupe in case a thread showed up in both lists.
  const seen = new Set();
  return threads.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

// A forum post's starter message shares its ID with the thread itself.
export async function getThreadStarterMessage(threadId) {
  try {
    return await discordGet(`/channels/${threadId}/messages/${threadId}`);
  } catch (e) {
    return null;
  }
}

// Thread creation time isn't always on the thread object directly for
// older threads; this derives a best-effort timestamp from the snowflake ID
// (Discord IDs encode their creation time).
export function snowflakeToDate(id) {
  const DISCORD_EPOCH = 1420070400000n;
  const ms = (BigInt(id) >> 22n) + DISCORD_EPOCH;
  return new Date(Number(ms));
}
