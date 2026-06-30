import { NextResponse } from "next/server";
import { getDb, ensureSchema, checkPasscode } from "../../../../lib/db";

export async function PATCH(req, { params }) {
  await ensureSchema();
  if (!checkPasscode(req)) {
    return NextResponse.json({ error: "Invalid passcode" }, { status: 401 });
  }
  const body = await req.json();
  const db = getDb();
  await db.execute({
    sql: "UPDATE bugs SET status = ? WHERE id = ?",
    args: [body.status, params.id],
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params }) {
  await ensureSchema();
  if (!checkPasscode(req)) {
    return NextResponse.json({ error: "Invalid passcode" }, { status: 401 });
  }
  const db = getDb();
  await db.execute({
    sql: "DELETE FROM bugs WHERE id = ?",
    args: [params.id],
  });
  return NextResponse.json({ ok: true });
}
