import { NextResponse } from "next/server";
import { findAccountByUsername, verifyPassword, createSession, seedOwnerIfNeeded } from "../../../../lib/auth";

export async function POST(req) {
  await seedOwnerIfNeeded();
  const { username, password } = await req.json();
  if (!username || !password) {
    return NextResponse.json({ error: "Username and password required" }, { status: 400 });
  }
  const account = await findAccountByUsername(username);
  if (!account || !(await verifyPassword(password, account.passwordHash))) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }
  await createSession(account);
  return NextResponse.json({ username: account.username, role: account.role });
}
