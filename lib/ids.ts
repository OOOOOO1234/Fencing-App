import { randomBytes } from "crypto";

export function newId() {
  return randomBytes(12).toString("hex");
}
