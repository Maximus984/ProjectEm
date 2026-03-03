import {
  adminRoleValues,
  destructiveAdminRoleValues,
  userRoleSchema,
  writableAdminRoleValues,
  type UserRole
} from "@projectm/contracts";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { enforceWorkspaceHours } from "../../middleware/access-control.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { writeAuditLog } from "../../utils/audit.js";

const pricingSchema = z.object({
  premiumGenius: z.number().positive(),
  byodMentorship: z.number().positive(),
  standardCare: z.number().positive()
});

const hardwareSchema = z.object({
  name: z.string().min(1).max(120),
  serialNumber: z.string().min(2).max(80),
  status: z.enum(["AVAILABLE", "MAINTENANCE", "RETIRED"]).default("AVAILABLE"),
  notes: z.string().max(300).optional()
});

const couponSchema = z.object({
  code: z.string().min(3).max(30).transform((value) => value.toUpperCase()),
  discountType: z.enum(["PERCENT", "AMOUNT"]),
  value: z.number().int().positive(),
  expiresAt: z.string().datetime().optional(),
  isActive: z.boolean().default(true)
});

const couponUpdateSchema = z.object({
  code: z.string().min(3).max(30).transform((value) => value.toUpperCase()).optional(),
  discountType: z.enum(["PERCENT", "AMOUNT"]).optional(),
  value: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional()
});

const workspacePolicyUpdateSchema = z.object({
  timezone: z.string().min(3).max(60).optional(),
  enabled: z.boolean().optional(),
  ownerStartHour: z.number().int().min(0).max(23).optional(),
  ownerEndHour: z.number().int().min(1).max(24).optional(),
  managerStartHour: z.number().int().min(0).max(23).optional(),
  managerEndHour: z.number().int().min(1).max(24).optional(),
  mediumStartHour: z.number().int().min(0).max(23).optional(),
  mediumEndHour: z.number().int().min(1).max(24).optional(),
  monitorStartHour: z.number().int().min(0).max(23).optional(),
  monitorEndHour: z.number().int().min(1).max(24).optional(),
  mentorStartHour: z.number().int().min(0).max(23).optional(),
  mentorEndHour: z.number().int().min(1).max(24).optional(),
  clientStartHour: z.number().int().min(0).max(23).optional(),
  clientEndHour: z.number().int().min(1).max(24).optional(),
  familyStartHour: z.number().int().min(0).max(23).optional(),
  familyEndHour: z.number().int().min(1).max(24).optional()
});

const ipBanCreateSchema = z.object({
  ipAddress: z.string().min(3).max(64),
  reason: z.string().max(240).optional(),
  expiresAt: z.string().datetime().optional()
});

const userRoleUpdateSchema = z.object({
  role: userRoleSchema
});

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole([...adminRoleValues]));
adminRouter.use(enforceWorkspaceHours);

adminRouter.get("/admin/access/permissions", (_req, res) => {
  res.json({
    roles: {
      OWNER: ["all", "delete_coupons", "manage_ip_bans", "manage_workspace_hours"],
      MANAGER: ["write_coupons", "delete_coupons", "manage_ip_bans", "manage_workspace_hours"],
      MEDIUM: ["write_coupons", "manage_hardware", "view_analytics", "view_audit_logs"],
      MONITOR: ["view_analytics", "view_coupons", "view_audit_logs", "monitor_messages"],
      CLIENT: ["client_workspace", "booking_requests", "project_visibility"],
      MENTOR: ["mentor_workflows", "session_updates"],
      FAMILY: ["family_dashboard", "bookings", "progress", "support"],
      CHILD: ["child_page", "assignments", "mentor_messages_limited"]
    }
  });
});

adminRouter.patch(
  "/admin/users/:id/role",
  requireRole([...destructiveAdminRoleValues]),
  validateBody(userRoleUpdateSchema),
  async (req, res) => {
    const actorRole = req.auth!.role;
    const nextRole = req.body.role as UserRole;

    if (
      actorRole !== "OWNER" &&
      ["OWNER", "MANAGER", "ADMIN"].includes(nextRole)
    ) {
      res.status(403).json({
        code: "FORBIDDEN_ROLE_ASSIGNMENT",
        message: "Only OWNER can assign OWNER, MANAGER, or ADMIN roles."
      });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user || user.deletedAt) {
      res.status(404).json({ code: "NOT_FOUND", message: "User not found." });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { role: nextRole }
    });

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "USER_ROLE_UPDATED",
      entity: "User",
      entityId: updated.id,
      before: { role: user.role },
      after: { role: updated.role },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json({
      userId: updated.id,
      role: updated.role
    });
  }
);

adminRouter.get("/admin/access/policy", async (_req, res) => {
  const policy = await prisma.workspacePolicy.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {}
  });

  res.json({ policy });
});

adminRouter.patch(
  "/admin/access/policy",
  requireRole([...writableAdminRoleValues]),
  validateBody(workspacePolicyUpdateSchema),
  async (req, res) => {
    const policy = await prisma.workspacePolicy.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        ...req.body
      },
      update: req.body
    });

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "WORKSPACE_POLICY_UPDATED",
      entity: "WorkspacePolicy",
      entityId: policy.id,
      after: req.body,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json({ policy });
  }
);

adminRouter.get("/admin/ip-bans", async (_req, res) => {
  const bans = await prisma.ipBan.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" }
  });

  res.json({ bans });
});

adminRouter.post(
  "/admin/ip-bans",
  requireRole([...destructiveAdminRoleValues]),
  validateBody(ipBanCreateSchema),
  async (req, res) => {
    const payload = req.body;
    const ban = await prisma.ipBan.upsert({
      where: { ipAddress: payload.ipAddress },
      create: {
        ipAddress: payload.ipAddress,
        reason: payload.reason,
        expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : undefined,
        createdById: req.auth?.userId,
        deletedAt: null
      },
      update: {
        reason: payload.reason,
        expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : undefined,
        createdById: req.auth?.userId,
        deletedAt: null
      }
    });

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "IP_BAN_UPSERT",
      entity: "IpBan",
      entityId: ban.id,
      after: { ipAddress: ban.ipAddress, expiresAt: ban.expiresAt, reason: ban.reason },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.status(201).json(ban);
  }
);

adminRouter.delete(
  "/admin/ip-bans/:id",
  requireRole([...destructiveAdminRoleValues]),
  async (req, res) => {
    const ban = await prisma.ipBan.findUnique({ where: { id: req.params.id } });
    if (!ban || ban.deletedAt) {
      res.status(404).json({ code: "NOT_FOUND", message: "IP ban not found." });
      return;
    }

    await prisma.ipBan.update({
      where: { id: ban.id },
      data: { deletedAt: new Date() }
    });

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "IP_BAN_DELETED",
      entity: "IpBan",
      entityId: ban.id,
      before: { ipAddress: ban.ipAddress },
      after: { deletedAt: true },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.status(204).send();
  }
);

adminRouter.get("/admin/analytics", async (_req, res) => {
  const [families, children, mentors, bookings, pendingMentors, supportTickets, coupons] = await Promise.all([
    prisma.family.count({ where: { deletedAt: null } }),
    prisma.child.count({ where: { deletedAt: null } }),
    prisma.mentor.count({ where: { deletedAt: null } }),
    prisma.booking.count({ where: { deletedAt: null } }),
    prisma.mentorApplication.count({ where: { status: "PENDING", deletedAt: null } }),
    prisma.supportTicket.count({ where: { status: "OPEN", deletedAt: null } }),
    prisma.coupon.count({ where: { deletedAt: null, isActive: true } })
  ]);

  res.json({
    families,
    children,
    mentors,
    bookings,
    pendingMentors,
    openSupportTickets: supportTickets,
    activeCoupons: coupons
  });
});

adminRouter.get("/admin/families/children-summary", async (_req, res) => {
  const families = await prisma.family.findMany({
    where: { deletedAt: null },
    include: {
      members: {
        where: { deletedAt: null },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true
            }
          }
        }
      },
      children: {
        where: { deletedAt: null },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          gradeLevel: true,
          userId: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  const totals = families.reduce(
    (acc, family) => {
      const childCount = family.children.length;
      const parentCount = family.members.filter((member) =>
        ["FAMILY", "PARENT"].includes(member.user.role)
      ).length;
      const childLogins = family.children.filter((child) => child.userId).length;

      return {
        families: acc.families + 1,
        children: acc.children + childCount,
        parents: acc.parents + parentCount,
        childrenWithLogins: acc.childrenWithLogins + childLogins
      };
    },
    {
      families: 0,
      children: 0,
      parents: 0,
      childrenWithLogins: 0
    }
  );

  res.json({
    totals,
    families: families.map((family) => ({
      familyId: family.id,
      familyName: family.name,
      parentCount: family.members.filter((member) => ["FAMILY", "PARENT"].includes(member.user.role)).length,
      childCount: family.children.length,
      parents: family.members
        .filter((member) => ["FAMILY", "PARENT"].includes(member.user.role))
        .map((member) => ({
          userId: member.user.id,
          firstName: member.user.firstName,
          lastName: member.user.lastName,
          email: member.user.email,
          role: member.user.role
        })),
      children: family.children.map((child) => ({
        id: child.id,
        firstName: child.firstName,
        lastName: child.lastName,
        gradeLevel: child.gradeLevel,
        childUserId: child.userId,
        hasChildLogin: Boolean(child.userId)
      }))
    }))
  });
});

adminRouter.post(
  "/admin/pricing",
  requireRole([...writableAdminRoleValues]),
  validateBody(pricingSchema),
  async (req, res) => {
    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "PRICING_UPDATED",
      entity: "Pricing",
      entityId: "active",
      after: req.body,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json({
      message: "Pricing updated in audit trail. Persist in dedicated PricingConfig table in next iteration.",
      pricing: req.body
    });
  }
);

adminRouter.post(
  "/admin/hardware",
  requireRole([...writableAdminRoleValues]),
  validateBody(hardwareSchema),
  async (req, res) => {
    const item = await prisma.hardwareInventory.create({
      data: req.body
    });

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "HARDWARE_CREATED",
      entity: "HardwareInventory",
      entityId: item.id,
      after: {
        serialNumber: item.serialNumber,
        status: item.status
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.status(201).json(item);
  }
);

adminRouter.get("/admin/audit-logs", async (req, res) => {
  const take = Number.parseInt(String(req.query.take ?? "100"), 10);
  const logs = await prisma.auditLog.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: Number.isNaN(take) ? 100 : Math.min(Math.max(take, 1), 500)
  });
  res.json({ logs });
});

adminRouter.post(
  "/admin/mentors/:id/approve",
  requireRole([...writableAdminRoleValues]),
  async (req, res) => {
    const application = await prisma.mentorApplication.findUnique({ where: { id: req.params.id } });
    if (!application || application.deletedAt) {
      res.status(404).json({ code: "NOT_FOUND", message: "Application not found." });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email: application.email } });
    if (!user) {
      res.status(400).json({
        code: "USER_MISSING",
        message: "No user exists for this mentor application. Create a user account first."
      });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.mentorApplication.update({
        where: { id: application.id },
        data: {
          status: "APPROVED",
          approvedById: req.auth?.userId
        }
      });

      const mentor = await tx.mentor.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          isVerified: true,
          verificationBadge: "Verified Mentor"
        },
        update: {
          isVerified: true,
          verificationBadge: "Verified Mentor"
        }
      });

      await tx.user.update({
        where: { id: user.id },
        data: { role: "MENTOR" }
      });

      return { updated, mentor };
    });

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "MENTOR_APPROVED",
      entity: "MentorApplication",
      entityId: application.id,
      before: { status: application.status },
      after: { status: result.updated.status, mentorId: result.mentor.id },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json({
      applicationId: result.updated.id,
      status: result.updated.status,
      mentorId: result.mentor.id
    });
  }
);

adminRouter.get("/admin/coupons", async (_req, res) => {
  const now = new Date();
  const coupons = await prisma.coupon.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" }
  });

  res.json({
    coupons: coupons.map((coupon) => ({
      ...coupon,
      isExpired: Boolean(coupon.expiresAt && coupon.expiresAt <= now),
      isCurrentlyValid: coupon.isActive && (!coupon.expiresAt || coupon.expiresAt > now)
    }))
  });
});

adminRouter.post(
  "/admin/coupons",
  requireRole([...writableAdminRoleValues]),
  validateBody(couponSchema),
  async (req, res) => {
    const payload = req.body;
    const coupon = await prisma.coupon.upsert({
      where: { code: payload.code },
      create: {
        code: payload.code,
        discountType: payload.discountType,
        value: payload.value,
        expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : undefined,
        isActive: payload.isActive,
        deletedAt: null
      },
      update: {
        discountType: payload.discountType,
        value: payload.value,
        expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : undefined,
        isActive: payload.isActive,
        deletedAt: null
      }
    });

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "COUPON_UPSERT",
      entity: "Coupon",
      entityId: coupon.id,
      after: {
        code: coupon.code,
        value: coupon.value,
        discountType: coupon.discountType,
        isActive: coupon.isActive
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.status(201).json(coupon);
  }
);

adminRouter.patch(
  "/admin/coupons/:id",
  requireRole([...writableAdminRoleValues]),
  validateBody(couponUpdateSchema),
  async (req, res) => {
    const existing = await prisma.coupon.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.deletedAt) {
      res.status(404).json({ code: "NOT_FOUND", message: "Coupon not found." });
      return;
    }

    const payload = req.body;
    const updated = await prisma.coupon.update({
      where: { id: req.params.id },
      data: {
        code: payload.code,
        discountType: payload.discountType,
        value: payload.value,
        isActive: payload.isActive,
        expiresAt: payload.expiresAt === null ? null : payload.expiresAt ? new Date(payload.expiresAt) : undefined
      }
    });

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "COUPON_UPDATED",
      entity: "Coupon",
      entityId: updated.id,
      before: {
        code: existing.code,
        value: existing.value,
        discountType: existing.discountType,
        isActive: existing.isActive
      },
      after: {
        code: updated.code,
        value: updated.value,
        discountType: updated.discountType,
        isActive: updated.isActive
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json(updated);
  }
);

adminRouter.delete(
  "/admin/coupons/:id",
  requireRole([...destructiveAdminRoleValues]),
  async (req, res) => {
    const existing = await prisma.coupon.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.deletedAt) {
      res.status(404).json({ code: "NOT_FOUND", message: "Coupon not found." });
      return;
    }

    await prisma.coupon.update({
      where: { id: req.params.id },
      data: {
        deletedAt: new Date(),
        isActive: false
      }
    });

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "COUPON_DELETED",
      entity: "Coupon",
      entityId: existing.id,
      before: {
        code: existing.code,
        isActive: existing.isActive
      },
      after: {
        deletedAt: true,
        isActive: false
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.status(204).send();
  }
);
