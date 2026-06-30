import { NextResponse } from "next/server";
import { runDiscordSync } from "../../../lib/discordSync";

export async function POST() {
  const result = await runDiscordSync({
    table: "suggestions",
    channelEnvVar: "DISCORD_SUGGESTION_FORUM_CHANNEL_ID",
    syncKey: "discord_suggestions_last_sync",
    missingConfigLabel: "DISCORD_SUGGESTION_FORUM_CHANNEL_ID",
  });
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
