import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions, isOwnerRole } from "../../../lib/auth";
import { getDb, ensureSchema } from "../../../lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !isOwnerRole(session.user.role)) {
    return NextResponse.json({ error: "Owner only" }, { status: 403 });
  }
  await ensureSchema();
  const db = getDb();
  const res = await db.execute("SELECT discordId, username, role, createdAt FROM users ORDER BY createdAt ASC");
  return NextResponse.json(res.rows);
}
