import { NextResponse } from "next/server";
import { getDb, ensureSchema, checkPasscode, uid } from "../../../../../lib/db";

export async function POST(req, { params }) {
  await ensureSchema();
  if (!checkPasscode(req)) {
    return NextResponse.json({ error: "Invalid passcode" }, { status: 401 });
  }
  const body = await req.json();
  if (!body.content || !body.content.trim()) {
    return NextResponse.json({ error: "Note content is required" }, { status: 400 });
  }
  const db = getDb();
  const res = await db.execute({
    sql: "SELECT notes FROM bugs WHERE id = ?",
    args: [params.id],
  });
  if (res.rows.length === 0) {
    return NextResponse.json({ error: "Bug not found" }, { status: 404 });
  }
  const notes = JSON.parse(res.rows[0].notes || "[]");
  const note = {
    id: uid(),
    author: (body.author || "").trim() || "Unknown",
    content: body.content.trim(),
    postedAt: new Date().toISOString(),
  };
  notes.unshift(note);
  await db.execute({
    sql: "UPDATE bugs SET notes = ? WHERE id = ?",
    args: [JSON.stringify(notes), params.id],
  });
  return NextResponse.json(note);
}
