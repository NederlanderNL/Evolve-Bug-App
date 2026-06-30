import DiscordProvider from "next-auth/providers/discord";
import { getDb, ensureSchema } from "./db";

export const ROLES = ["helper", "community_manager", "moderator", "admin", "owner"];

export const ROLE_LABELS = {
  helper: "Helper",
  community_manager: "Community Manager",
  moderator: "Moderator",
  admin: "Admin",
  owner: "Owner",
};

// Bugs/suggestions editing (status changes, dev notes, delete, creating new
// entries) is restricted to these roles.
export function canEditContent(role) {
  return role === "community_manager" || role === "admin" || role === "owner";
}

export function isOwnerRole(role) {
  return role === "owner";
}

// OWNER_DISCORD_IDS is a comma-separated list of Discord user IDs (the long
// numeric "snowflake", not the username) who should automatically become
// Owner the first time they sign in. Get your ID by enabling Developer Mode
// in Discord settings, then right-click your profile → Copy User ID.
const OWNER_IDS = (process.env.OWNER_DISCORD_IDS || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

async function getOrCreateUser(discordId, username) {
  await ensureSchema();
  const db = getDb();
  const existing = await db.execute({
    sql: "SELECT * FROM users WHERE discordId = ?",
    args: [discordId],
  });
  if (existing.rows.length > 0) {
    // Keep the stored username fresh in case they changed it on Discord,
    // but never touch their role here — only an Owner changes roles.
    if (existing.rows[0].username !== username) {
      await db.execute({
        sql: "UPDATE users SET username = ? WHERE discordId = ?",
        args: [username, discordId],
      });
    }
    return { ...existing.rows[0], username };
  }
  const role = OWNER_IDS.includes(discordId) ? "owner" : "helper";
  const createdAt = new Date().toISOString();
  await db.execute({
    sql: "INSERT INTO users (discordId, username, role, createdAt) VALUES (?, ?, ?, ?)",
    args: [discordId, username, role, createdAt],
  });
  return { discordId, username, role, createdAt };
}

export const authOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, profile }) {
      if (profile) {
        // Fresh sign-in — profile is the raw Discord profile.
        const discordId = profile.id;
        const username =
          profile.discriminator && profile.discriminator !== "0"
            ? `${profile.username}#${profile.discriminator}`
            : profile.username;
        const user = await getOrCreateUser(discordId, username);
        token.discordId = discordId;
        token.username = username;
        token.role = user.role;
      } else if (token.discordId) {
        // Subsequent requests — re-check their role in case an Owner just
        // changed it, without requiring them to sign out and back in.
        try {
          await ensureSchema();
          const db = getDb();
          const res = await db.execute({
            sql: "SELECT role FROM users WHERE discordId = ?",
            args: [token.discordId],
          });
          if (res.rows.length > 0) token.role = res.rows[0].role;
        } catch (e) {
          // keep last-known role if the lookup fails
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user.discordId = token.discordId;
      session.user.role = token.role || "helper";
      session.user.name = token.username || session.user.name;
      return session;
    },
  },
};
