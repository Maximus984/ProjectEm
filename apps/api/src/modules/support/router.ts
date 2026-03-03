import { Router } from "express";
import {
  isAdminRole,
  supportContacts,
  supportTicketSchema
} from "@projectm/contracts";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { writeAuditLog } from "../../utils/audit.js";

export const supportRouter = Router();

supportRouter.get("/support/contacts", (_req, res) => {
  res.json({
    ...supportContacts,
    communityNotice:
      "Discord and Instagram are external community channels. Use in-app support for account-specific help."
  });
});

supportRouter.post("/support/tickets", validateBody(supportTicketSchema), async (req, res) => {
  const payload = req.body;
  const user = await prisma.user.findUnique({ where: { email: payload.contactEmail } });

  const ticket = await prisma.supportTicket.create({
    data: {
      userId: user?.id,
      subject: payload.subject,
      category: payload.category,
      message: payload.message,
      status: "OPEN"
    }
  });

  await writeAuditLog({
    actorUserId: user?.id,
    action: "SUPPORT_TICKET_CREATED",
    entity: "SupportTicket",
    entityId: ticket.id,
    after: {
      subject: ticket.subject,
      category: ticket.category,
      status: ticket.status
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"]
  });

  res.status(201).json({
    ticketId: ticket.id,
    status: ticket.status,
    message: "Support ticket submitted successfully."
  });
});

supportRouter.get("/support/tickets", requireAuth, async (req, res) => {
  const where = req.auth && isAdminRole(req.auth.role)
    ? { deletedAt: null }
    : { userId: req.auth?.userId, deletedAt: null };
  const tickets = await prisma.supportTicket.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });
  res.json({ tickets });
});

supportRouter.get("/support/staff", requireAuth, async (_req, res) => {
  const staffRoles = ["OWNER", "MANAGER", "MEDIUM", "MONITOR", "ADMIN", "MENTOR"] as const;

  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      role: {
        in: [...staffRoles]
      }
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      isActive: true
    },
    orderBy: [{ role: "asc" }, { firstName: "asc" }]
  });

  res.json({
    staff: users.map((user) => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      isActive: user.isActive
    }))
  });
});
