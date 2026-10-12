import { NextResponse } from "next/server";
import { currentUser } from "./auth";

export async function requireUser() {
  const user = await currentUser();
  if (!user) {
    return { user: null, response: NextResponse.json({ error: "Sign in first." }, { status: 401 }) };
  }
  return { user, response: null as null };
}
