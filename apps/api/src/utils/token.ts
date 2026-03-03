import jwt, { type SignOptions } from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";

export type AccessTokenPayload = {
  sub: string;
  role: string;
  email: string;
};

export function signAccessToken(payload: AccessTokenPayload): string {
  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_TTL as SignOptions["expiresIn"],
    issuer: "projectm-api",
    audience: "projectm-web"
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

export function signRefreshToken(payload: { sub: string }): string {
  const options: SignOptions = {
    expiresIn: env.JWT_REFRESH_TTL as SignOptions["expiresIn"],
    issuer: "projectm-api",
    audience: "projectm-web-refresh",
    jwtid: randomUUID()
  };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: "projectm-api",
    audience: "projectm-web"
  }) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, {
    issuer: "projectm-api",
    audience: "projectm-web-refresh"
  }) as { sub: string };
}
