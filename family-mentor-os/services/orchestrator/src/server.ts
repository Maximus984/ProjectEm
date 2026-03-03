import "./types/express";
import http from "http";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { redis } from "./lib/redis";
import { createApp } from "./app";
import { AttemptService } from "./services/attempt-service";
import { createSocketServer } from "./ws/setup";

async function bootstrap() {
  const server = http.createServer();
  const io = createSocketServer(server);
  const service = new AttemptService(prisma, redis, io, env.BREAK_DURATION_SECONDS);
  const app = createApp(service);
  server.on("request", app);

  setInterval(() => {
    service.heartbeatSweep().catch((error) => {
      console.error("timer sweep failed", error);
    });
  }, 1000);

  server.listen(env.PORT, () => {
    console.log(`orchestrator running on :${env.PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
