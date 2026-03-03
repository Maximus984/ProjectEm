import { Router } from "express";
import {
  adminRoleValues,
  childPageSaveSchema,
  familyRoleValues
} from "@projectm/contracts";
import { prisma } from "../../config/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { writeAuditLog } from "../../utils/audit.js";

export const pagesRouter = Router();

pagesRouter.get("/children/:id/page", requireAuth, async (req, res) => {
  const page = await prisma.childPage.findUnique({
    where: { childId: req.params.id },
    include: {
      sections: {
        where: { deletedAt: null },
        orderBy: { sortOrder: "asc" }
      },
      versions: {
        where: { deletedAt: null },
        orderBy: { version: "desc" },
        take: 20
      }
    }
  });

  if (!page || page.deletedAt) {
    res.status(404).json({ code: "NOT_FOUND", message: "Child page not found." });
    return;
  }

  res.json(page);
});

pagesRouter.post(
  "/children/:id/page/save",
  requireAuth,
  requireRole([...familyRoleValues, "CHILD", "MENTOR", ...adminRoleValues]),
  validateBody(childPageSaveSchema),
  async (req, res) => {
    const payload = req.body;

    if (payload.childId !== req.params.id) {
      res.status(400).json({ code: "MISMATCH", message: "childId mismatch in request." });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const page = await tx.childPage.upsert({
        where: { childId: payload.childId },
        create: {
          childId: payload.childId,
          title: payload.title,
          themeKey: payload.themeKey,
          publicVisible: payload.publicVisible,
          draftState: payload.sections
        },
        update: {
          title: payload.title,
          themeKey: payload.themeKey,
          publicVisible: payload.publicVisible,
          draftState: payload.sections
        }
      });

      await tx.pageSection.updateMany({
        where: { pageId: page.id },
        data: { deletedAt: new Date() }
      });

      if (payload.sections.length > 0) {
        await tx.pageSection.createMany({
          data: payload.sections.map((section) => ({
            pageId: page.id,
            sectionType: section.type,
            sortOrder: section.order,
            data: section.data
          }))
        });
      }

      const latest = await tx.pageVersion.findFirst({
        where: { pageId: page.id },
        orderBy: { version: "desc" }
      });

      const nextVersion = (latest?.version ?? 0) + 1;
      await tx.pageVersion.create({
        data: {
          pageId: page.id,
          version: nextVersion,
          snapshot: {
            title: payload.title,
            themeKey: payload.themeKey,
            publicVisible: payload.publicVisible,
            sections: payload.sections
          },
          createdById: req.auth?.userId
        }
      });

      return page;
    });

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "CHILD_PAGE_SAVED",
      entity: "ChildPage",
      entityId: result.id,
      after: {
        title: result.title,
        publicVisible: result.publicVisible
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json({ pageId: result.id, saved: true });
  }
);

pagesRouter.get("/children/:id/page/versions", requireAuth, async (req, res) => {
  const page = await prisma.childPage.findUnique({ where: { childId: req.params.id } });
  if (!page || page.deletedAt) {
    res.status(404).json({ code: "NOT_FOUND", message: "Child page not found." });
    return;
  }

  const versions = await prisma.pageVersion.findMany({
    where: {
      pageId: page.id,
      deletedAt: null
    },
    orderBy: { version: "desc" }
  });

  res.json({ childId: req.params.id, versions });
});

pagesRouter.post(
  "/children/:id/page/publish",
  requireAuth,
  requireRole([...familyRoleValues, ...adminRoleValues]),
  async (req, res) => {
    const page = await prisma.childPage.findUnique({ where: { childId: req.params.id } });
    if (!page || page.deletedAt) {
      res.status(404).json({ code: "NOT_FOUND", message: "Child page not found." });
      return;
    }

    const updated = await prisma.childPage.update({
      where: { id: page.id },
      data: {
        publicVisible: true,
        approvedAt: new Date(),
        approvedById: req.auth?.userId
      }
    });

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "CHILD_PAGE_PUBLISHED",
      entity: "ChildPage",
      entityId: updated.id,
      before: { publicVisible: page.publicVisible },
      after: { publicVisible: updated.publicVisible },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json({ pageId: updated.id, publicVisible: updated.publicVisible, approvedAt: updated.approvedAt });
  }
);
