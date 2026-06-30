import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions, isOwnerRole, ROLES } from "../../../../lib/auth";
import { getDb, ensureSchema } from "../../../../lib/db";

export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || !isOwnerRole(session.user.role)) {
    return NextResponse.json({ error: "Owner only" }, { status: 403 });
  }
  const body = await req.json();
  if (!ROLES.includes(body.role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  await ensureSchema();
  const db = getDb();
  await db.execute({
    sql: "UPDATE users SET role = ? WHERE discordId = ?",
    args: [body.role, params.discordId],
  });
  return NextResponse.json({ ok: true });
}
