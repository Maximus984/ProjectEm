import { Router } from "express";
import { adminRoleValues, mentorApplicationSchema } from "@projectm/contracts";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { writeAuditLog } from "../../utils/audit.js";

const mentorStatusSchema = z.object({
  status: z.enum(["EN_ROUTE", "ARRIVED", "IN_SESSION", "COMPLETED"]),
  etaMinutes: z.number().int().nonnegative().max(240).optional(),
  locationNote: z.string().max(200).optional(),
  bookingId: z.string().uuid().optional()
});

export const mentorRouter = Router();

mentorRouter.post("/mentor-applications", validateBody(mentorApplicationSchema), async (req, res) => {
  const payload = req.body;

  const existingUser = await prisma.user.findUnique({ where: { email: payload.email } });

  const application = await prisma.mentorApplication.create({
    data: {
      userId: existingUser?.id,
      fullName: payload.fullName,
      email: payload.email,
      phone: payload.phone,
      resumeUrl: payload.resumeUrl,
      hasBackgroundConsent: true,
      availabilitySummary: payload.availabilitySummary,
      preferredTopics: payload.preferredTopics,
      status: "PENDING"
    }
  });

  await writeAuditLog({
    actorUserId: existingUser?.id,
    action: "MENTOR_APPLICATION_SUBMITTED",
    entity: "MentorApplication",
    entityId: application.id,
    after: {
      email: application.email,
      status: application.status
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"]
  });

  res.status(201).json({
    applicationId: application.id,
    status: application.status
  });
});

mentorRouter.get("/mentors/:id/live-status", async (req, res) => {
  const status = await prisma.mentorLiveStatus.findFirst({
    where: {
      mentorId: req.params.id,
      deletedAt: null
    },
    include: {
      mentor: {
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      }
    }
  });

  if (!status) {
    res.status(404).json({ code: "NOT_FOUND", message: "Live status unavailable." });
    return;
  }

  res.json({
    mentorId: status.mentorId,
    mentorName: `${status.mentor.user.firstName} ${status.mentor.user.lastName}`,
    status: status.status,
    etaMinutes: status.etaMinutes,
    locationNote: status.locationNote,
    ratingAverage: status.ratingAverage
  });
});

mentorRouter.post(
  "/mentors/:id/status",
  requireAuth,
  requireRole(["MENTOR", ...adminRoleValues]),
  validateBody(mentorStatusSchema),
  async (req, res) => {
    const payload = req.body;

    const status = await prisma.mentorLiveStatus.upsert({
      where: { mentorId: req.params.id },
      create: {
        mentorId: req.params.id,
        status: payload.status,
        etaMinutes: payload.etaMinutes,
        locationNote: payload.locationNote,
        currentBookingId: payload.bookingId
      },
      update: {
        status: payload.status,
        etaMinutes: payload.etaMinutes,
        locationNote: payload.locationNote,
        currentBookingId: payload.bookingId
      }
    });

    if (payload.bookingId) {
      await prisma.sessionStatusUpdate.create({
        data: {
          bookingId: payload.bookingId,
          mentorId: req.params.id,
          actorUserId: req.auth?.userId,
          status: payload.status,
          note: payload.locationNote
        }
      });
    }

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "MENTOR_STATUS_UPDATED",
      entity: "MentorLiveStatus",
      entityId: status.id,
      after: {
        mentorId: status.mentorId,
        status: status.status,
        etaMinutes: status.etaMinutes
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json({
      mentorId: status.mentorId,
      status: status.status,
      etaMinutes: status.etaMinutes,
      locationNote: status.locationNote
    });
  }
);
