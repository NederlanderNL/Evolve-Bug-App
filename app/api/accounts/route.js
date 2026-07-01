import { NextResponse } from "next/server";
import { getSession, isOwner, listAccounts, createAccount, ROLES } from "../../../lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session || !isOwner(session.role)) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  return NextResponse.json(await listAccounts());
}

export async function POST(req) {
  const session = await getSession();
  if (!session || !isOwner(session.role)) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const { username, password, role } = await req.json();
  if (!username?.trim() || !password) return NextResponse.json({ error: "Username and password required" }, { status: 400 });
  if (role && !ROLES.includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  try {
    const account = await createAccount(username, password, role || "helper");
    return NextResponse.json(account);
  } catch (e) {
    if (e.message?.includes("UNIQUE")) return NextResponse.json({ error: "Username already exists" }, { status: 409 });
    throw e;
  }
}
