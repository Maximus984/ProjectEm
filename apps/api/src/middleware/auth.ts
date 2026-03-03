import type { NextFunction, Response } from "express";
import type { UserRole } from "@projectm/contracts";
import { verifyAccessToken } from "../utils/token.js";
import type { RequestWithAuth } from "../types.js";

export function requireAuth(req: RequestWithAuth, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ code: "AUTH_REQUIRED", message: "Missing bearer token." });
    return;
  }

  try {
    const payload = verifyAccessToken(header.slice(7));
    req.auth = {
      userId: payload.sub,
      email: payload.email,
      role: payload.role as UserRole
    };
    next();
  } catch {
    res.status(401).json({ code: "INVALID_TOKEN", message: "Invalid or expired token." });
  }
}

export function requireRole(roles: UserRole[]) {
  return (req: RequestWithAuth, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ code: "AUTH_REQUIRED", message: "Authentication required." });
      return;
    }

    if (!roles.includes(req.auth.role)) {
      res.status(403).json({ code: "FORBIDDEN", message: "Insufficient permissions." });
      return;
    }

    next();
  };
}
