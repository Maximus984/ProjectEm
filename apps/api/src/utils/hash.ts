import { createHash, randomBytes } from "node:crypto";

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function randomDigits(length = 6): string {
  const max = 10 ** length;
  const num = Number.parseInt(randomBytes(4).toString("hex"), 16) % max;
  return String(num).padStart(length, "0");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
