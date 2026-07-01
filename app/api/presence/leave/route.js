import { getDb, ensureSchema } from "../../../../lib/db";

export async function POST(req) {
  try {
    const { sessionId } = await req.json();
    if (!sessionId) return new Response("ok");
    await ensureSchema();
    const db = getDb();
    await db.execute({ sql: "DELETE FROM presence WHERE sessionId = ?", args: [sessionId] });
  } catch (e) {
    // best-effort
  }
  return new Response("ok");
}
