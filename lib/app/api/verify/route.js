import { NextResponse } from "next/server";
import { checkPasscode } from "../../../lib/db";

export async function POST(req) {
  if (!checkPasscode(req)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
