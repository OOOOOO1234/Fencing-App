import { NextResponse } from "next/server";
import { emailTaken, hashPassword, normalizeEmail, publicUser, setSession } from "@/lib/auth";
import { insertUser } from "@/lib/db";
import { newId } from "@/lib/ids";

export async function POST(request: Request) {
  const body = (await request.json()) as { name?: string; email?: string; password?: string };
  const name = body.name?.trim() ?? "";
  const email = normalizeEmail(body.email ?? "");
  const password = body.password ?? "";
  if (!name || !email.includes("@") || password.length < 8) {
    return NextResponse.json(
      { error: "Use your name, a real email, and a password of at least 8 characters." },
      { status: 400 },
    );
  }
  if (emailTaken(email)) {
    return NextResponse.json({ error: "That email already has an account." }, { status: 409 });
  }
  const { hash, salt } = hashPassword(password);
  const user = {
    id: newId(),
    email,
    name,
    password_hash: hash,
    password_salt: salt,
    created_at: new Date().toISOString(),
  };
  insertUser(user);
  await setSession(user.id);
  return NextResponse.json({ user: publicUser(user) });
}
