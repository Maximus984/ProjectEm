import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { adminRouter } from "./modules/admin/router.js";
import { academicsRouter } from "./modules/academics/router.js";
import { authRouter } from "./modules/auth/router.js";
import { availabilityRouter } from "./modules/availability/router.js";
import { bookingsRouter } from "./modules/bookings/router.js";
import { checkinRouter } from "./modules/checkin/router.js";
import { familyRouter } from "./modules/families/router.js";
import { healthRouter } from "./modules/health/router.js";
import { integrationRouter } from "./modules/integrations/router.js";
import { mentorRouter } from "./modules/mentors/router.js";
import { messagingRouter } from "./modules/messaging/router.js";
import { diagnosticRouter } from "./modules/diagnostics/router.js";
import { pagesRouter } from "./modules/pages/router.js";
import { supportRouter } from "./modules/support/router.js";
import { enforceIpBan } from "./middleware/access-control.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requestContext } from "./middleware/request-context.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const legacyDir = path.resolve(__dirname, "../../../legacy");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: "RATE_LIMITED",
    message: "Too many authentication attempts. Try again later."
  }
});

export function createApp() {
  const app = express();
  const configuredOrigins = env.WEB_ORIGIN.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const allowAllOrigins = configuredOrigins.length === 0;
  const allowedOrigins = new Set([
    ...configuredOrigins,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost",
    "https://localhost",
    "capacitor://localhost"
  ]);

  app.set("trust proxy", 1);
  app.use(requestContext);
  app.use(
    cors({
      origin: (origin, callback) => {
        const isNetlifyPreview = typeof origin === "string" && (origin.endsWith(".netlify.app") || origin.endsWith(".netlify.live"));
        if (!origin || allowAllOrigins || allowedOrigins.has(origin) || isNetlifyPreview) {
          callback(null, true);
          return;
        }
        callback(new Error(`Origin ${origin} is not allowed by CORS`));
      },
      credentials: true
    })
  );
  app.use(
    helmet({
      contentSecurityPolicy: false
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(morgan("dev"));

  app.use("/legacy", express.static(legacyDir, { extensions: ["html"] }));

  const api = express.Router();
  api.use(enforceIpBan);
  api.use("/auth", authLimiter, authRouter);
  api.use(healthRouter);
  api.use(availabilityRouter);
  api.use(bookingsRouter);
  api.use(checkinRouter);
  api.use(familyRouter);
  api.use(academicsRouter);
  api.use(mentorRouter);
  api.use(messagingRouter);
  api.use(diagnosticRouter);
  api.use(pagesRouter);
  api.use(supportRouter);
  api.use(adminRouter);
  api.use(integrationRouter);

  app.use("/api/v1", api);
  const isServerless = process.env.NETLIFY === "true" || process.env.PROJECTM_SERVERLESS === "true";
  if (isServerless) {
    app.use("/", api);
    app.use("/.netlify/functions/api", api);
  }

  app.get("/", (_req, res) => {
    res.json({
      service: "ProjectM API",
      version: "v1",
      docs: "/api/v1/health"
    });
  });

  app.use((req, res) => {
    res.status(404).json({ code: "NOT_FOUND", message: `Route ${req.method} ${req.path} not found.` });
  });

  app.use(errorHandler);

  return app;
}
