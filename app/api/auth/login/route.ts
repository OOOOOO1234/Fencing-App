import { NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/db";
import { normalizeEmail, passwordMatches, publicUser, setSession } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string };
  const user = findUserByEmail(normalizeEmail(body.email ?? ""));
  if (!user || !passwordMatches(body.password ?? "", user)) {
    return NextResponse.json({ error: "Email or password is wrong." }, { status: 401 });
  }
  await setSession(user.id);
  return NextResponse.json({ user: publicUser(user) });
}
