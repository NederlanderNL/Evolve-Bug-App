import { NextResponse } from "next/server";
import { getDb, ensureSchema, checkPasscode } from "../../../../../../lib/db";

export async function DELETE(req, { params }) {
  await ensureSchema();
  if (!checkPasscode(req)) {
    return NextResponse.json({ error: "Invalid passcode" }, { status: 401 });
  }
  const db = getDb();
  const res = await db.execute({
    sql: "SELECT notes FROM bugs WHERE id = ?",
    args: [params.id],
  });
  if (res.rows.length === 0) {
    return NextResponse.json({ error: "Bug not found" }, { status: 404 });
  }
  const notes = JSON.parse(res.rows[0].notes || "[]").filter((n) => n.id !== params.noteId);
  await db.execute({
    sql: "UPDATE bugs SET notes = ? WHERE id = ?",
    args: [JSON.stringify(notes), params.id],
  });
  return NextResponse.json({ ok: true });
}
