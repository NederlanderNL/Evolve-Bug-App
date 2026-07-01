import { NextResponse } from "next/server";
import { getSession, isOwner, updateAccountRole, updateAccountPassword, deleteAccount, ROLES } from "../../../../lib/auth";

export async function PATCH(req, { params }) {
  const session = await getSession();
  if (!session || !isOwner(session.role)) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const body = await req.json();
  if (body.role !== undefined) {
    if (!ROLES.includes(body.role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    await updateAccountRole(params.id, body.role);
  }
  if (body.password !== undefined) {
    if (!body.password) return NextResponse.json({ error: "Password required" }, { status: 400 });
    await updateAccountPassword(params.id, body.password);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params }) {
  const session = await getSession();
  if (!session || !isOwner(session.role)) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  await deleteAccount(params.id);
  return NextResponse.json({ ok: true });
}
