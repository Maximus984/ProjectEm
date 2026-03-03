import { Router } from "express";
import { z } from "zod";
import type { AttemptService } from "../services/attempt-service";
import { answerSchema, breakSchema, heartbeatSchema, startTestSchema, submitSchema } from "../types/api";

function parseBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  return schema.parse(body);
}

export function testsRouter(service: AttemptService) {
  const router = Router();

  router.post("/api/tests/:testId/start", async (req, res) => {
    try {
      const body = parseBody(startTestSchema, req.body);
      const data = await service.startAttempt(req.params.testId, req.auth!, body.durationSeconds);
      res.status(201).json(data);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });

  router.post("/api/tests/:testId/answer", async (req, res) => {
    try {
      const body = parseBody(answerSchema, req.body);
      const data = await service.saveAnswer(req.params.testId, req.auth!, {
        attemptId: body.attemptId,
        itemId: body.itemId,
        answer: body.answer,
        timeSpentSec: body.timeSpentSec
      });
      res.json(data);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });

  router.post("/api/tests/:testId/break", async (req, res) => {
    try {
      const body = parseBody(breakSchema, req.body);
      const data = await service.requestBreak(req.params.testId, req.auth!, body.attemptId);
      res.json(data);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });

  router.post("/api/tests/:testId/resume", async (req, res) => {
    try {
      const body = parseBody(breakSchema, req.body);
      const data = await service.resumeBreak(req.params.testId, req.auth!, body.attemptId);
      res.json(data);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });

  router.post("/api/tests/:testId/heartbeat", async (req, res) => {
    try {
      const body = parseBody(heartbeatSchema, req.body);
      const data = await service.heartbeat(req.params.testId, req.auth!, body);
      res.json(data);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });

  router.post("/api/tests/:testId/submit", async (req, res) => {
    try {
      const body = parseBody(submitSchema, req.body);
      const data = await service.submitAttempt(req.params.testId, req.auth!, body.attemptId, false);
      res.json(data);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });

  router.get("/api/tests/attempt/:attemptId/results", async (req, res) => {
    try {
      const data = await service.getResults(req.params.attemptId, req.auth!);
      res.json(data);
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  });

  return router;
}
