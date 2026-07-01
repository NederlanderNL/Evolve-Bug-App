import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { getDb, ensureSchema, uid } from "./db";

const SESSION_COOKIE = "erb_session";
const JWT_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || "evolve-report-board-dev-secret-change-in-production"
);
const SESSION_DURATION = 60 * 60 * 24 * 7; // 7 days

export const ROLES = ["helper", "moderator", "community_manager", "admin", "owner"];
export const ROLE_LABELS = {
  helper: "Helper",
  moderator: "Moderator",
  community_manager: "Community Manager",
  admin: "Admin",
  owner: "Owner",
};

// Owners can do everything. Admins and Community Managers can edit content.
export function canEditContent(role) {
  return ["community_manager", "admin", "owner"].includes(role);
}
export function isOwner(role) {
  return role === "owner";
}

// ── Session ──────────────────────────────────────────────────────────────────

export async function createSession(user) {
  const token = await new SignJWT({
    id: user.id,
    username: user.username,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(JWT_SECRET);

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION,
    path: "/",
  });

  return token;
}

export async function getSession() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload;
  } catch (e) {
    return null;
  }
}

export async function clearSession() {
  cookies().set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
}

// ── Account management ───────────────────────────────────────────────────────

export async function findAccountByUsername(username) {
  await ensureSchema();
  const db = getDb();
  const res = await db.execute({
    sql: "SELECT * FROM staff_accounts WHERE username = ?",
    args: [username.trim()],
  });
  return res.rows[0] || null;
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export async function createAccount(username, password, role = "helper") {
  await ensureSchema();
  const db = getDb();
  const hash = await bcrypt.hash(password, 10);
  const id = uid();
  await db.execute({
    sql: "INSERT INTO staff_accounts (id, username, passwordHash, role, createdAt) VALUES (?, ?, ?, ?, ?)",
    args: [id, username.trim(), hash, role, new Date().toISOString()],
  });
  return { id, username: username.trim(), role };
}

export async function listAccounts() {
  await ensureSchema();
  const db = getDb();
  const res = await db.execute(
    "SELECT id, username, role, createdAt FROM staff_accounts ORDER BY createdAt ASC"
  );
  return res.rows;
}

export async function updateAccountRole(id, role) {
  await ensureSchema();
  const db = getDb();
  await db.execute({ sql: "UPDATE staff_accounts SET role = ? WHERE id = ?", args: [role, id] });
}

export async function updateAccountPassword(id, newPassword) {
  await ensureSchema();
  const db = getDb();
  const hash = await bcrypt.hash(newPassword, 10);
  await db.execute({ sql: "UPDATE staff_accounts SET passwordHash = ? WHERE id = ?", args: [hash, id] });
}

export async function deleteAccount(id) {
  await ensureSchema();
  const db = getDb();
  await db.execute({ sql: "DELETE FROM staff_accounts WHERE id = ?", args: [id] });
}

// ── Owner seed ────────────────────────────────────────────────────────────────
// Creates the first owner account from env vars on first boot if no accounts
// exist yet. OWNER_USERNAME and OWNER_PASSWORD must be set in Vercel env vars.

export async function seedOwnerIfNeeded() {
  await ensureSchema();
  const db = getDb();
  const count = await db.execute("SELECT COUNT(*) as c FROM staff_accounts");
  if (Number(count.rows[0].c) > 0) return; // accounts already exist

  const username = process.env.OWNER_USERNAME;
  const password = process.env.OWNER_PASSWORD;
  if (!username || !password) return; // env vars not set — skip

  await createAccount(username, password, "owner");
}
