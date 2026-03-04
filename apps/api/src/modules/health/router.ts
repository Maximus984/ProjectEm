import { Router } from "express";
import { prisma } from "../../config/prisma.js";

const boot = Date.now();

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "ok",
      service: "projectm-api",
      uptimeSeconds: Math.floor((Date.now() - boot) / 1000),
      db: "up"
    });
  } catch {
    res.status(503).json({ status: "degraded", db: "down" });
  }
});

healthRouter.get("/metrics", async (_req, res) => {
  const [users, bookings, tickets] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.booking.count({ where: { deletedAt: null } }),
    prisma.supportTicket.count({ where: { deletedAt: null } })
  ]);

  res.type("text/plain").send(
    [
      `projectm_users_total ${users}`,
      `projectm_bookings_total ${bookings}`,
      `projectm_support_tickets_total ${tickets}`
    ].join("\n")
  );
});

healthRouter.get("/access/q-gate", async (_req, res) => {
  const policy = await prisma.workspacePolicy.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {}
  });

  res.json({
    qGateEnabled: policy.qGateEnabled,
    qGateMessage: policy.qGateMessage,
    updatedAt: policy.updatedAt
  });
});
