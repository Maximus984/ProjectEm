import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";

export function validateBody(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
      res.status(400).json({ message: "Validation failed", code: "VALIDATION_ERROR", issues });
      return;
    }

    req.body = parsed.data;
    next();
  };
}
