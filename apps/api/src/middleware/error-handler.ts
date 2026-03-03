import { Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof Prisma.PrismaClientInitializationError) {
    console.error(`[${req.method} ${req.path}]`, err.message);
    res.status(503).json({
      code: "DATABASE_UNAVAILABLE",
      message: "The database is currently unavailable. Try again shortly.",
      requestId: res.getHeader("x-request-id")
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    console.error(`[${req.method} ${req.path}]`, `${err.code}: ${err.message}`);

    if (err.code === "P2002") {
      res.status(409).json({
        code: "CONFLICT",
        message: "That record already exists.",
        requestId: res.getHeader("x-request-id")
      });
      return;
    }

    if (err.code === "P2021" || err.code === "P2022") {
      res.status(500).json({
        code: "DATABASE_SCHEMA_MISSING",
        message: "Database schema is not initialized. Run deployment schema sync before accepting signups.",
        requestId: res.getHeader("x-request-id")
      });
      return;
    }

    res.status(500).json({
      code: "DATABASE_ERROR",
      message: "A database error occurred while processing the request.",
      requestId: res.getHeader("x-request-id")
    });
    return;
  }

  if (err instanceof Error) {
    console.error(`[${req.method} ${req.path}]`, err.message);
    res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
      requestId: res.getHeader("x-request-id")
    });
    return;
  }

  res.status(500).json({
    code: "INTERNAL_ERROR",
    message: "An unknown error occurred.",
    requestId: res.getHeader("x-request-id")
  });
}
