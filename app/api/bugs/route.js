import { NextResponse } from "next/server";
import { getDb, ensureSchema, checkPasscode, uid } from "../../../lib/db";

function rowToBug(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    reporter: row.reporter,
    priority: row.priority,
    status: row.status,
    reportedAt: row.reportedAt,
    notes: JSON.parse(row.notes || "[]"),
  };
}

export async function GET() {
  await ensureSchema();
  const db = getDb();
  const res = await db.execute("SELECT * FROM bugs ORDER BY reportedAt DESC");
  return NextResponse.json(res.rows.map(rowToBug));
}

export async function POST(req) {
  await ensureSchema();
  if (!checkPasscode(req)) {
    return NextResponse.json({ error: "Invalid passcode" }, { status: 401 });
  }
  const body = await req.json();
  if (!body.title || !body.title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  const db = getDb();
  const bug = {
    id: uid(),
    title: body.title.trim(),
    description: (body.description || "").trim(),
    reporter: (body.reporter || "").trim() || "Unknown",
    priority: body.priority || "medium",
    status: "open",
    reportedAt: new Date().toISOString(),
    notes: [],
  };
  await db.execute({
    sql: "INSERT INTO bugs (id, title, description, reporter, priority, status, reportedAt, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    args: [bug.id, bug.title, bug.description, bug.reporter, bug.priority, bug.status, bug.reportedAt, JSON.stringify(bug.notes)],
  });
  return NextResponse.json(bug);
}
