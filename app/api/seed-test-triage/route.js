import { NextResponse } from "next/server";
import { getDb, ensureSchema, uid } from "../../../lib/db";

// Temporary helper for trying out the triage panel without setting up the
// real Discord sync. Inserts a handful of fake "needs triage" bugs and
// suggestions. Safe to remove later (or just stop calling it from the UI).
const TEST_BUGS = [
  { title: "Fire spell clips through prayer shield", description: "Reported in-game, the animation overlaps oddly when blocking with Protect from Magic." },
  { title: "Bank interface freezes on rapid withdraw-all", description: "Happens after spamming the withdraw-all button a few times in a row." },
  { title: "Slayer task counter not decrementing", description: "Killed 4 of the assigned monster but the counter still shows the original amount." },
];

const TEST_SUGGESTIONS = [
  { title: "Add a slayer task reroll option", description: "Would help reduce frustration with bad task assignments." },
  { title: "Bigger bank space for ironman accounts", description: "Several players have mentioned running out of bank space earlier than expected." },
];

export async function POST() {
  await ensureSchema();
  const db = getDb();

  const insert = async (table, entry) => {
    const item = {
      id: uid(),
      title: entry.title,
      description: entry.description,
      reporter: "Test Player",
      priority: "unsorted",
      status: "open",
      reportedAt: new Date().toISOString(),
      notes: [],
    };
    await db.execute({
      sql: `INSERT INTO ${table} (id, title, description, reporter, priority, status, reportedAt, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [item.id, item.title, item.description, item.reporter, item.priority, item.status, item.reportedAt, JSON.stringify(item.notes)],
    });
  };

  for (const b of TEST_BUGS) await insert("bugs", b);
  for (const s of TEST_SUGGESTIONS) await insert("suggestions", s);

  return NextResponse.json({ ok: true, added: TEST_BUGS.length + TEST_SUGGESTIONS.length });
}
