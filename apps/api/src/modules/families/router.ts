import { Router } from "express";
import { adminRoleValues, familyRoleValues } from "@projectm/contracts";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { hashPassword } from "../../utils/password.js";
import { writeAuditLog } from "../../utils/audit.js";

const familyCreateSchema = z.object({
  name: z.string().min(2).max(120)
});

const addParentSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email(),
  phone: z.string().min(7).max(30),
  password: z.string().min(10).max(128),
  billingRole: z.enum(["PRIMARY", "SECONDARY"]).default("SECONDARY")
});

const addChildSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  dob: z.string().date().optional(),
  gradeLevel: z.string().max(30).optional()
});

export const familyRouter = Router();

familyRouter.post("/families", requireAuth, validateBody(familyCreateSchema), async (req, res) => {
  const family = await prisma.family.create({ data: { name: req.body.name } });
  await prisma.familyMember.create({
    data: {
      familyId: family.id,
      userId: req.auth!.userId,
      billingRole: "PRIMARY"
    }
  });

  await writeAuditLog({
    actorUserId: req.auth?.userId,
    action: "FAMILY_CREATED",
    entity: "Family",
    entityId: family.id,
    after: { name: family.name },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"]
  });

  res.status(201).json({ familyId: family.id });
});

familyRouter.post(
  "/families/:id/add-parent",
  requireAuth,
  requireRole([...familyRoleValues, ...adminRoleValues]),
  validateBody(addParentSchema),
  async (req, res) => {
    const familyId = req.params.id;
    const members = await prisma.familyMember.findMany({
      where: {
        familyId,
        deletedAt: null,
        user: { role: { in: [...familyRoleValues] } }
      },
      include: { user: true }
    });

    if (members.length >= 2) {
      res.status(400).json({ code: "PARENT_LIMIT", message: "A family can have up to 2 parent accounts." });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email: req.body.email } });
    if (existing) {
      res.status(409).json({ code: "EMAIL_TAKEN", message: "Email already in use." });
      return;
    }

    const passwordHash = await hashPassword(req.body.password);
    const parent = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          email: req.body.email,
          phone: req.body.phone,
          passwordHash,
          role: "FAMILY"
        }
      });

      await tx.familyMember.create({
        data: {
          familyId,
          userId: user.id,
          billingRole: req.body.billingRole
        }
      });

      return user;
    });

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "FAMILY_PARENT_ADDED",
      entity: "Family",
      entityId: familyId,
      after: { parentUserId: parent.id, email: parent.email },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.status(201).json({ parentUserId: parent.id });
  }
);

familyRouter.post(
  "/families/:id/add-child",
  requireAuth,
  requireRole([...familyRoleValues, ...adminRoleValues]),
  validateBody(addChildSchema),
  async (req, res) => {
    const familyId = req.params.id;
    const children = await prisma.child.count({ where: { familyId, deletedAt: null } });

    if (children >= 5) {
      res.status(400).json({ code: "CHILD_LIMIT", message: "A family can have up to 5 children." });
      return;
    }

    const child = await prisma.child.create({
      data: {
        familyId,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        dob: req.body.dob ? new Date(req.body.dob) : undefined,
        gradeLevel: req.body.gradeLevel
      }
    });

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "FAMILY_CHILD_ADDED",
      entity: "Family",
      entityId: familyId,
      after: { childId: child.id },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.status(201).json({ childId: child.id });
  }
);

familyRouter.get("/families/me", requireAuth, async (req, res) => {
  const memberships = await prisma.familyMember.findMany({
    where: {
      userId: req.auth!.userId,
      deletedAt: null,
      family: { deletedAt: null }
    },
    orderBy: { createdAt: "asc" },
    include: {
      family: {
        include: {
          members: {
            where: { deletedAt: null },
            include: { user: true }
          },
          children: {
            where: { deletedAt: null },
            orderBy: { createdAt: "asc" }
          }
        }
      }
    }
  });

  if (!memberships.length) {
    res.status(404).json({ code: "NOT_FOUND", message: "No family membership found for this account." });
    return;
  }

  const primaryMembership = memberships[0];
  const family = primaryMembership.family;

  res.json({
    familyId: family.id,
    name: family.name,
    childCount: family.children.length,
    parentCount: family.members.filter((member) => familyRoleValues.includes(member.user.role as (typeof familyRoleValues)[number])).length,
    billingRole: primaryMembership.billingRole,
    children: family.children.map((child) => ({
      id: child.id,
      firstName: child.firstName,
      lastName: child.lastName,
      gradeLevel: child.gradeLevel
    })),
    members: family.members.map((member) => ({
      userId: member.userId,
      firstName: member.user.firstName,
      lastName: member.user.lastName,
      email: member.user.email,
      role: member.user.role,
      billingRole: member.billingRole
    }))
  });
});

familyRouter.get("/families/:id", requireAuth, async (req, res) => {
  const family = await prisma.family.findUnique({
    where: { id: req.params.id },
    include: {
      members: {
        where: { deletedAt: null },
        include: { user: true }
      },
      children: {
        where: { deletedAt: null }
      }
    }
  });

  if (!family || family.deletedAt) {
    res.status(404).json({ code: "NOT_FOUND", message: "Family not found." });
    return;
  }

  res.json({
    familyId: family.id,
    name: family.name,
    childCount: family.children.length,
    members: family.members.map((m) => ({
      userId: m.userId,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      email: m.user.email,
      role: m.user.role,
      billingRole: m.billingRole
    })),
    children: family.children
  });
});
