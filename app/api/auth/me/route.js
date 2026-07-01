import { NextResponse } from "next/server";
import { getSession, seedOwnerIfNeeded } from "../../../../lib/auth";

export async function GET() {
  await seedOwnerIfNeeded();
  const session = await getSession();
  if (!session) return NextResponse.json(null);
  return NextResponse.json({ username: session.username, role: session.role, id: session.id });
}
