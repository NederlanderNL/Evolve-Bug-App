import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { getDb, ensureSchema, uid } from "./db";
import { authOptions, canEditContent } from "./auth";

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
    upvotes: row.upvotes ?? 0,
    downvotes: row.downvotes ?? 0,
  };
}

async function requireEditSession() {
  const session = await getServerSession(authOptions);
  if (!session || !canEditContent(session.user.role)) {
    return null;
  }
  return session;
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
    if (!(await requireEditSession())) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
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
    if (!(await requireEditSession())) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
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
    if (!(await requireEditSession())) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
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
    const session = await requireEditSession();
    if (!session) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
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
      // Notes are authored by whoever is logged in — no need to type a name.
      author: session.user.name || "Unknown",
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
    if (!(await requireEditSession())) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
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

// Voting just requires being signed in (any of the 5 roles). Votes are
// keyed by Discord ID, not a typed name, so they can't be spoofed and
// follow the person across devices. Sending { type: null } retracts.
export function createVoteHandler(table) {
  async function POST(req, { params }) {
    await ensureSchema();
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Sign in to vote" }, { status: 401 });
    }
    const voter = session.user.discordId;
    const body = await req.json();
    const type = body.type === "up" || body.type === "down" ? body.type : null;
    const votesTable = `${table}_votes`;
    const db = getDb();

    const existing = await db.execute({
      sql: `SELECT type FROM ${votesTable} WHERE suggestionId = ? AND voter = ?`,
      args: [params.id, voter],
    });
    const previousType = existing.rows.length ? existing.rows[0].type : null;

    if (type === null) {
      if (previousType) {
        await db.execute({
          sql: `DELETE FROM ${votesTable} WHERE suggestionId = ? AND voter = ?`,
          args: [params.id, voter],
        });
      }
    } else if (previousType) {
      await db.execute({
        sql: `UPDATE ${votesTable} SET type = ?, votedAt = ? WHERE suggestionId = ? AND voter = ?`,
        args: [type, new Date().toISOString(), params.id, voter],
      });
    } else {
      await db.execute({
        sql: `INSERT INTO ${votesTable} (suggestionId, voter, type, votedAt) VALUES (?, ?, ?, ?)`,
        args: [params.id, voter, type, new Date().toISOString()],
      });
    }

    const upRes = await db.execute({
      sql: `SELECT COUNT(*) as c FROM ${votesTable} WHERE suggestionId = ? AND type = 'up'`,
      args: [params.id],
    });
    const downRes = await db.execute({
      sql: `SELECT COUNT(*) as c FROM ${votesTable} WHERE suggestionId = ? AND type = 'down'`,
      args: [params.id],
    });
    const upvotes = Number(upRes.rows[0]?.c ?? 0);
    const downvotes = Number(downRes.rows[0]?.c ?? 0);

    await db.execute({
      sql: `UPDATE ${table} SET upvotes = ?, downvotes = ? WHERE id = ?`,
      args: [upvotes, downvotes, params.id],
    });

    return NextResponse.json({ upvotes, downvotes, type });
  }

  return { POST };
}

// Looks up how the *currently signed-in* user has voted across all
// suggestions, so the UI can restore their vote state automatically.
export function createMyVotesHandler(table) {
  async function GET() {
    await ensureSchema();
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({});
    const voter = session.user.discordId;
    const votesTable = `${table}_votes`;
    const db = getDb();
    const res = await db.execute({
      sql: `SELECT suggestionId, type FROM ${votesTable} WHERE voter = ?`,
      args: [voter],
    });
    const map = {};
    for (const row of res.rows) map[row.suggestionId] = row.type;
    return NextResponse.json(map);
  }

  return { GET };
}
