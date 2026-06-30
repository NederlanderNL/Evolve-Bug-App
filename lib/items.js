import { NextResponse } from "next/server";
import { getDb, ensureSchema, checkPasscode, uid } from "./db";

function rowToItem(row) {
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

// table must be a hardcoded safe value ("bugs" or "suggestions"), never user input.
export function createCollectionHandlers(table) {
  async function GET() {
    await ensureSchema();
    const db = getDb();
    const res = await db.execute(`SELECT * FROM ${table} ORDER BY reportedAt DESC`);
    return NextResponse.json(res.rows.map(rowToItem));
  }

  async function POST(req) {
    await ensureSchema();
    if (!checkPasscode(req)) {
      return NextResponse.json({ error: "Invalid passcode" }, { status: 401 });
    }
    const body = await req.json();
    if (!body.title || !body.title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    const db = getDb();
    const item = {
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
      sql: `INSERT INTO ${table} (id, title, description, reporter, priority, status, reportedAt, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [item.id, item.title, item.description, item.reporter, item.priority, item.status, item.reportedAt, JSON.stringify(item.notes)],
    });
    return NextResponse.json(item);
  }

  return { GET, POST };
}

export function createItemHandlers(table) {
  async function PATCH(req, { params }) {
    await ensureSchema();
    if (!checkPasscode(req)) {
      return NextResponse.json({ error: "Invalid passcode" }, { status: 401 });
    }
    const body = await req.json();
    const db = getDb();
    await db.execute({
      sql: `UPDATE ${table} SET status = ? WHERE id = ?`,
      args: [body.status, params.id],
    });
    return NextResponse.json({ ok: true });
  }

  async function DELETE(req, { params }) {
    await ensureSchema();
    if (!checkPasscode(req)) {
      return NextResponse.json({ error: "Invalid passcode" }, { status: 401 });
    }
    const db = getDb();
    await db.execute({
      sql: `DELETE FROM ${table} WHERE id = ?`,
      args: [params.id],
    });
    return NextResponse.json({ ok: true });
  }

  return { PATCH, DELETE };
}

export function createNoteHandlers(table) {
  async function POST(req, { params }) {
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
      sql: `SELECT notes FROM ${table} WHERE id = ?`,
      args: [params.id],
    });
    if (res.rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
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
      sql: `UPDATE ${table} SET notes = ? WHERE id = ?`,
      args: [JSON.stringify(notes), params.id],
    });
    return NextResponse.json(note);
  }

  return { POST };
}

export function createNoteItemHandlers(table) {
  async function DELETE(req, { params }) {
    await ensureSchema();
    if (!checkPasscode(req)) {
      return NextResponse.json({ error: "Invalid passcode" }, { status: 401 });
    }
    const db = getDb();
    const res = await db.execute({
      sql: `SELECT notes FROM ${table} WHERE id = ?`,
      args: [params.id],
    });
    if (res.rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const notes = JSON.parse(res.rows[0].notes || "[]").filter((n) => n.id !== params.noteId);
    await db.execute({
      sql: `UPDATE ${table} SET notes = ? WHERE id = ?`,
      args: [JSON.stringify(notes), params.id],
    });
    return NextResponse.json({ ok: true });
  }

  return { DELETE };
}
