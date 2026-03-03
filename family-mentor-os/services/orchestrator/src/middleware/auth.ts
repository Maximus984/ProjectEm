import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

type JwtPayload = {
  sub: string;
  tenantId: string;
  role: string;
};

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader && env.NODE_ENV !== "production") {
    const devUserId = req.headers["x-dev-user-id"];
    const devTenantId = req.headers["x-dev-tenant-id"];
    const devRole = req.headers["x-dev-role"];

    if (
      typeof devUserId === "string" &&
      typeof devTenantId === "string" &&
      typeof devRole === "string"
    ) {
      req.auth = {
        userId: devUserId,
        tenantId: devTenantId,
        role: devRole
      };
      next();
      return;
    }
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ message: "Missing bearer token" });
    return;
  }

  try {
    const token = authHeader.slice("Bearer ".length);
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    if (!decoded?.sub || !decoded.tenantId || !decoded.role) {
      throw new Error("Invalid token payload");
    }

    req.auth = {
      userId: decoded.sub,
      tenantId: decoded.tenantId,
      role: decoded.role
    };
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    if (!roles.includes(req.auth.role)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    next();
  };
}
