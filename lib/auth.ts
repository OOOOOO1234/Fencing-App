import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { deleteSession, findUserByEmail, insertSession, insertUser, userForSession, type User } from "./db";

const COOKIE = "sabre_session";

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 32).toString("hex");
  return { hash, salt };
}

export function passwordMatches(password: string, user: User) {
  const actual = Buffer.from(hashPassword(password, user.password_salt).hash, "hex");
  const expected = Buffer.from(user.password_hash, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export async function setSession(userId: string) {
  const token = randomBytes(24).toString("hex");
  insertSession(token, userId);
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) deleteSession(token);
  jar.delete(COOKIE);
}

export async function currentUser() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  return userForSession(token) ?? null;
}

export function publicUser(user: User) {
  return { id: user.id, email: user.email, name: user.name };
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function emailTaken(email: string) {
  return Boolean(findUserByEmail(normalizeEmail(email)));
}

export { insertUser };
