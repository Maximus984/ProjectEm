import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { writeAuditLog } from "../../utils/audit.js";

const bookingWebhookSchema = z.object({
  bookingId: z.string().uuid(),
  event: z.literal("booking_created"),
  payload: z.record(z.any()).optional()
});

const paymentWebhookSchema = z.object({
  bookingId: z.string().uuid(),
  event: z.literal("payment_succeeded"),
  amountCents: z.number().int().positive(),
  stripePaymentIntentId: z.string().optional()
});

export const integrationRouter = Router();

integrationRouter.post("/webhooks/booking-created", async (req, res) => {
  const parsed = bookingWebhookSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ code: "VALIDATION_ERROR", message: "Invalid webhook payload." });
    return;
  }

  await writeAuditLog({
    action: "WEBHOOK_BOOKING_CREATED",
    entity: "Booking",
    entityId: parsed.data.bookingId,
    after: parsed.data,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"]
  });

  res.status(202).json({ accepted: true });
});

integrationRouter.post("/webhooks/payment-succeeded", async (req, res) => {
  const parsed = paymentWebhookSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ code: "VALIDATION_ERROR", message: "Invalid webhook payload." });
    return;
  }

  const payload = parsed.data;

  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        bookingId: payload.bookingId,
        amountCents: payload.amountCents,
        status: "SUCCEEDED",
        kind: "ONE_OFF",
        stripePaymentIntentId: payload.stripePaymentIntentId
      }
    });

    await tx.booking.update({
      where: { id: payload.bookingId },
      data: {
        status: "PAID",
        paidCents: payload.amountCents
      }
    });
  });

  await writeAuditLog({
    action: "WEBHOOK_PAYMENT_SUCCEEDED",
    entity: "Payment",
    entityId: payload.bookingId,
    after: payload,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"]
  });

  res.status(202).json({ accepted: true });
});
