import { randomUUID } from "node:crypto";
import type { NextFunction, Response } from "express";
import type { RequestWithAuth } from "../types.js";

export function requestContext(req: RequestWithAuth, res: Response, next: NextFunction): void {
  req.requestId = randomUUID();
  res.setHeader("x-request-id", req.requestId);
  next();
}
