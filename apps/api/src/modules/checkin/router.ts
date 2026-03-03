import { Router } from "express";
import { checkinCodeSchema, checkinQrSchema } from "@projectm/contracts";
import { prisma } from "../../config/prisma.js";
import { validateBody } from "../../middleware/validate.js";
import { sha256 } from "../../utils/hash.js";
import { writeAuditLog } from "../../utils/audit.js";

export const checkinRouter = Router();

checkinRouter.post("/checkin/scan-qr", validateBody(checkinQrSchema), async (req, res) => {
  const { qrToken } = req.body;
  const qrHash = sha256(qrToken);

  const booking = await prisma.booking.findFirst({
    where: {
      qrTokenHash: qrHash,
      deletedAt: null
    },
    include: {
      checkins: true,
      verificationCode: true
    }
  });

  if (!booking) {
    res.status(404).json({ code: "QR_INVALID", message: "QR token invalid." });
    return;
  }

  if (booking.checkins.length > 0) {
    res.status(409).json({ code: "QR_REUSED", message: "QR token already used." });
    return;
  }

  if (booking.verificationCode?.expiresAt && booking.verificationCode.expiresAt < new Date()) {
    res.status(410).json({ code: "QR_EXPIRED", message: "QR token expired." });
    return;
  }

  const checkin = await prisma.$transaction(async (tx) => {
    const created = await tx.checkin.create({
      data: {
        bookingId: booking.id,
        verificationCodeId: booking.verificationCode?.id,
        method: "QR",
        sourceIp: req.ip,
        userAgent: req.headers["user-agent"]
      }
    });

    await tx.booking.update({
      where: { id: booking.id },
      data: { status: "CHECKED_IN" }
    });

    if (booking.verificationCode) {
      await tx.verificationCode.update({
        where: { id: booking.verificationCode.id },
        data: { consumedAt: new Date() }
      });
    }

    return created;
  });

  await writeAuditLog({
    action: "CHECKIN_QR",
    entity: "Checkin",
    entityId: checkin.id,
    after: {
      bookingId: booking.id,
      method: "QR"
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"]
  });

  res.json({
    ok: true,
    bookingId: booking.id,
    checkedInAt: checkin.checkedInAt,
    method: "qr"
  });
});

checkinRouter.post("/checkin/verify-code", validateBody(checkinCodeSchema), async (req, res) => {
  const { bookingId, code } = req.body;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      verificationCode: true
    }
  });

  if (!booking || !booking.verificationCode || booking.deletedAt) {
    res.status(404).json({ code: "BOOKING_NOT_FOUND", message: "Booking or verification code not found." });
    return;
  }

  const record = booking.verificationCode;

  if (record.lockedUntil && record.lockedUntil > new Date()) {
    res.status(429).json({ code: "CODE_LOCKED", message: "Too many invalid attempts. Try again later." });
    return;
  }

  if (record.expiresAt < new Date()) {
    res.status(410).json({ code: "CODE_EXPIRED", message: "Verification code expired." });
    return;
  }

  if (record.consumedAt) {
    res.status(409).json({ code: "CODE_USED", message: "Verification code already used." });
    return;
  }

  const valid = sha256(code) === record.hash;
  if (!valid) {
    const attempts = record.attempts + 1;
    const lockNow = attempts >= 5;

    await prisma.verificationCode.update({
      where: { id: record.id },
      data: {
        attempts,
        lockedUntil: lockNow ? new Date(Date.now() + 15 * 60 * 1000) : null
      }
    });

    res.status(401).json({ code: "CODE_INVALID", message: "Invalid verification code." });
    return;
  }

  const checkin = await prisma.$transaction(async (tx) => {
    const created = await tx.checkin.create({
      data: {
        bookingId,
        verificationCodeId: record.id,
        method: "PIN",
        sourceIp: req.ip,
        userAgent: req.headers["user-agent"]
      }
    });

    await tx.verificationCode.update({
      where: { id: record.id },
      data: {
        consumedAt: new Date(),
        attempts: record.attempts + 1
      }
    });

    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: "CHECKED_IN"
      }
    });

    return created;
  });

  await writeAuditLog({
    action: "CHECKIN_PIN",
    entity: "Checkin",
    entityId: checkin.id,
    after: {
      bookingId,
      method: "PIN"
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"]
  });

  res.json({ ok: true, bookingId, checkedInAt: checkin.checkedInAt, method: "pin" });
});
