import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import type { AttemptService } from "./services/attempt-service";
import { requireAuth } from "./middleware/auth";
import { attemptsRouter } from "./routes/attempts";
import { submissionsRouter } from "./routes/submissions";
import { testsRouter } from "./routes/tests";

export function createApp(service: AttemptService) {
  const app = express();

  app.use(cors());
  app.use(helmet());
  app.use(express.json({ limit: "2mb" }));
  app.use(morgan("dev"));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "orchestrator" });
  });

  app.use(requireAuth);
  app.use(testsRouter(service));
  app.use(submissionsRouter(service));
  app.use(attemptsRouter(service));

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ message: err.message || "Internal Server Error" });
  });

  return app;
}
