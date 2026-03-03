import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "../config/env.js";

function getKey(): Buffer {
  const source = env.DIAGNOSTIC_LOG_ENCRYPTION_KEY ?? env.JWT_ACCESS_SECRET;
  return createHash("sha256").update(source).digest().subarray(0, 32);
}

export function encryptJson(value: unknown): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64")}.${authTag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptJson(payload: string): unknown {
  const [ivB64, authTagB64, encryptedB64] = payload.split(".");
  if (!ivB64 || !authTagB64 || !encryptedB64) {
    return null;
  }

  const key = getKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));

  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedB64, "base64")), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8"));
}
