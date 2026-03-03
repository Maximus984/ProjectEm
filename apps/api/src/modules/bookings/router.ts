import { Router } from "express";
import { adminRoleValues, bookingCreateSchema, familyRoleValues } from "@projectm/contracts";
import { z } from "zod";
import QRCode from "qrcode";
import { prisma } from "../../config/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { randomDigits, randomToken, sha256 } from "../../utils/hash.js";
import { sendCheckinSms } from "../../utils/sms.js";
import { writeAuditLog } from "../../utils/audit.js";

const activeStatuses = ["SUBMITTED", "ZOOM_INTERVIEW", "CONFIRMED", "SESSION_IN_PROGRESS"] as const;

const scheduleZoomSchema = z.object({
  scheduledTime: z.string().datetime(),
  startUrl: z.string().url().optional()
});

function combineDateAndTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00.000Z`);
}

export const bookingsRouter = Router();

bookingsRouter.post(
  "/bookings",
  requireAuth,
  requireRole([...familyRoleValues, ...adminRoleValues]),
  validateBody(bookingCreateSchema),
  async (req, res) => {
    const payload = req.body;
    const isAdmin = adminRoleValues.includes(req.auth!.role as (typeof adminRoleValues)[number]);

    if (!isAdmin) {
      const membership = await prisma.familyMember.findFirst({
        where: {
          familyId: payload.familyId,
          userId: req.auth!.userId,
          deletedAt: null
        }
      });

      if (!membership) {
        res.status(403).json({ code: "FORBIDDEN", message: "You can only book for your own family account." });
        return;
      }
    }

    const child = await prisma.child.findFirst({
      where: {
        id: payload.childId,
        familyId: payload.familyId,
        deletedAt: null
      }
    });

    if (!child) {
      res.status(404).json({ code: "CHILD_NOT_FOUND", message: "Child not found in family." });
      return;
    }

    if (payload.startTime >= payload.endTime) {
      res.status(400).json({ code: "INVALID_TIME_RANGE", message: "End time must be after start time." });
      return;
    }

    const dateStart = new Date(`${payload.date}T00:00:00.000Z`);
    const dateEnd = new Date(`${payload.date}T23:59:59.999Z`);

    const childConflict = await prisma.booking.findFirst({
      where: {
        childId: payload.childId,
        date: { gte: dateStart, lte: dateEnd },
        startTime: payload.startTime,
        status: { in: [...activeStatuses] },
        deletedAt: null
      }
    });

    if (childConflict) {
      res.status(409).json({ code: "DOUBLE_BOOK_CONFLICT", message: "Child already has a booking at this time." });
      return;
    }

    const startAt = combineDateAndTime(payload.date, payload.startTime);
    const endAt = combineDateAndTime(payload.date, payload.endTime);

    let hardwareId: string | null = null;
    if (payload.requiresHardware) {
      const hardware = await prisma.hardwareInventory.findMany({
        where: { status: "AVAILABLE", deletedAt: null },
        orderBy: { createdAt: "asc" }
      });

      for (const item of hardware) {
        const overlap = await prisma.hardwareReservation.findFirst({
          where: {
            hardwareId: item.id,
            deletedAt: null,
            startAt: { lt: endAt },
            endAt: { gt: startAt }
          }
        });

        if (!overlap) {
          hardwareId = item.id;
          break;
        }
      }

      if (!hardwareId) {
        res.status(409).json({
          code: "HARDWARE_CONFLICT",
          message: "No hardware unit available for selected timeslot."
        });
        return;
      }
    }

    let couponId: string | undefined;
    if (payload.couponCode) {
      const normalizedCouponCode = payload.couponCode.trim().toUpperCase();
      const coupon = await prisma.coupon.findFirst({
        where: {
          code: normalizedCouponCode,
          isActive: true,
          deletedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
        }
      });
      if (!coupon) {
        res.status(400).json({ code: "COUPON_INVALID", message: "Coupon is invalid or expired." });
        return;
      }
      couponId = coupon.id;
    }

    const rateByTier = {
      PREMIUM_GENIUS: 45,
      BYOD_MENTORSHIP: 40,
      STANDARD_CARE: 32
    } as const;

    const startHour = Number.parseInt(payload.startTime.slice(0, 2), 10);
    const endHour = Number.parseInt(payload.endTime.slice(0, 2), 10);
    const durationHours = Math.max(1, endHour - startHour);

    const verificationCode = randomDigits(6);
    const verificationHash = sha256(verificationCode);
    const qrToken = randomToken(32);
    const qrTokenHash = sha256(qrToken);

    const booking = await prisma.$transaction(async (tx) => {
      const created = await tx.booking.create({
        data: {
          familyId: payload.familyId,
          childId: payload.childId,
          tier: payload.tier,
          status: "SUBMITTED",
          mode: payload.mode,
          timezone: payload.timezone,
          date: dateStart,
          startTime: payload.startTime,
          endTime: payload.endTime,
          notes: payload.notes,
          requiresHardware: payload.requiresHardware,
          parentOptOutZoomIntro: payload.parentOptOutZoomIntro,
          paymentRequired: true,
          qrTokenHash,
          owedCents: rateByTier[payload.tier] * 100 * durationHours,
          billedMinutes: durationHours * 60,
          couponId
        }
      });

      await tx.verificationCode.create({
        data: {
          bookingId: created.id,
          hash: verificationHash,
          expiresAt: new Date(startAt.getTime() + 2 * 60 * 60 * 1000)
        }
      });

      if (payload.requiresHardware && hardwareId) {
        await tx.hardwareReservation.create({
          data: {
            bookingId: created.id,
            hardwareId,
            startAt,
            endAt
          }
        });
      }

      return created;
    });

    const familyParents = await prisma.familyMember.findMany({
      where: { familyId: payload.familyId, deletedAt: null },
      include: { user: true }
    });

    const parentPhone = familyParents.map((m) => m.user.phone).find(Boolean);
    let smsDelivery: { sent: boolean; reason?: string } = { sent: false, reason: "No parent phone found" };

    if (parentPhone) {
      smsDelivery = await sendCheckinSms(
        parentPhone,
        `ProjectM booking ${booking.id} created. Check-in code: ${verificationCode}. Keep this code private.`
      );
    }

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "BOOKING_CREATED",
      entity: "Booking",
      entityId: booking.id,
      after: {
        bookingId: booking.id,
        familyId: booking.familyId,
        childId: booking.childId,
        tier: booking.tier
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    const qrDataUrl = await QRCode.toDataURL(JSON.stringify({ bookingId: booking.id, token: qrToken }));

    res.status(201).json({
      bookingId: booking.id,
      status: booking.status,
      verificationCode,
      qr: {
        token: qrToken,
        imageDataUrl: qrDataUrl,
        singleUse: true
      },
      smsDelivery
    });
  }
);

bookingsRouter.patch("/bookings/:id/cancel", requireAuth, async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!booking || booking.deletedAt) {
    res.status(404).json({ code: "NOT_FOUND", message: "Booking not found." });
    return;
  }

  if (booking.status === "COMPLETED" || booking.status === "PAID") {
    res.status(400).json({ code: "INVALID_STATUS", message: "Completed booking cannot be canceled." });
    return;
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "CANCELED" }
  });

  await writeAuditLog({
    actorUserId: req.auth?.userId,
    action: "BOOKING_CANCELED",
    entity: "Booking",
    entityId: booking.id,
    before: { status: booking.status },
    after: { status: updated.status },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"]
  });

  res.json({ bookingId: updated.id, status: updated.status });
});

bookingsRouter.get("/bookings/:id/status", async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.id },
    include: {
      verificationCode: true,
      checkins: {
        orderBy: { checkedInAt: "desc" },
        take: 1
      }
    }
  });

  if (!booking || booking.deletedAt) {
    res.status(404).json({ code: "NOT_FOUND", message: "Booking not found." });
    return;
  }

  const code = typeof req.query.code === "string" ? req.query.code : undefined;
  const codeMatches = code ? sha256(code) === booking.verificationCode?.hash : false;

  if (!req.headers.authorization && !codeMatches) {
    res.status(401).json({
      code: "AUTH_REQUIRED",
      message: "Provide bearer token or booking verification code."
    });
    return;
  }

  res.json({
    bookingId: booking.id,
    status: booking.status,
    date: booking.date,
    startTime: booking.startTime,
    endTime: booking.endTime,
    checkedInAt: booking.checkins[0]?.checkedInAt ?? null,
    introCompleted: booking.introCompleted
  });
});

bookingsRouter.post(
  "/sessions/:id/schedule-zoom",
  requireAuth,
  requireRole([...adminRoleValues, "MENTOR"]),
  validateBody(scheduleZoomSchema),
  async (req, res) => {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking || booking.deletedAt) {
      res.status(404).json({ code: "NOT_FOUND", message: "Booking not found." });
      return;
    }

    const data = req.body;

    const zoom = await prisma.zoomMeeting.upsert({
      where: { bookingId: booking.id },
      create: {
        bookingId: booking.id,
        zoomMeetingId: `sandbox_${booking.id.slice(0, 12)}`,
        joinUrl: `https://zoom.us/j/${booking.id.slice(0, 10)}`,
        startUrl: data.startUrl,
        scheduledTime: new Date(data.scheduledTime),
        metadata: { provider: "zoom", mode: "sandbox" }
      },
      update: {
        scheduledTime: new Date(data.scheduledTime),
        startUrl: data.startUrl
      }
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "ZOOM_INTERVIEW" }
    });

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "ZOOM_SCHEDULED",
      entity: "ZoomMeeting",
      entityId: zoom.id,
      after: {
        bookingId: booking.id,
        zoomMeetingId: zoom.zoomMeetingId,
        scheduledTime: zoom.scheduledTime
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.status(201).json({
      zoomMeetingId: zoom.zoomMeetingId,
      joinUrl: zoom.joinUrl,
      scheduledTime: zoom.scheduledTime,
      metadata: zoom.metadata
    });
  }
);
