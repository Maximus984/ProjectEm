import { Router } from "express";
import { z } from "zod";
import type { AttemptService } from "../services/attempt-service";
import { overrideSchema } from "../types/api";

export function attemptsRouter(service: AttemptService) {
  const router = Router();

  router.post("/api/attempts/:attemptId/override", async (req, res) => {
    try {
      const payload = overrideSchema.parse(req.body);
      const log = await service.overrideAttempt(req.params.attemptId, req.auth!, payload.verdict, payload.note);
      res.status(201).json(log);
    } catch (error) {
      const message = (error as Error).message;
      const status = message === "Forbidden" ? 403 : 400;
      res.status(status).json({ message });
    }
  });

  return router;
}
