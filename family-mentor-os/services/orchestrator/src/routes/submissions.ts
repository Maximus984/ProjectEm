import { Router } from "express";
import type { AttemptService } from "../services/attempt-service";

export function submissionsRouter(service: AttemptService) {
  const router = Router();

  router.post("/api/submissions/:attemptId/compare", async (req, res) => {
    try {
      const data = await service.compareSubmission(req.params.attemptId, req.auth!);
      res.json(data);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });

  return router;
}
