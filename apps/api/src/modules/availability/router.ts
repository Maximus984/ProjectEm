import { Router } from "express";
import { availabilityQuerySchema } from "@projectm/contracts";
import { prisma } from "../../config/prisma.js";

export const availabilityRouter = Router();

availabilityRouter.get("/availability", async (req, res) => {
  const parsed = availabilityQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ code: "VALIDATION_ERROR", message: "Invalid availability query." });
    return;
  }

  const { date, tier } = parsed.data;
  const day = new Date(`${date}T00:00:00.000Z`);
  const next = new Date(`${date}T23:59:59.999Z`);

  const existing = await prisma.booking.findMany({
    where: {
      date: { gte: day, lte: next },
      status: { in: ["SUBMITTED", "ZOOM_INTERVIEW", "CONFIRMED", "SESSION_IN_PROGRESS"] },
      deletedAt: null,
      tier
    },
    select: {
      startTime: true,
      endTime: true
    }
  });

  const blocked = new Set(existing.map((item) => item.startTime));
  const slots: Array<{ startTime: string; endTime: string; available: boolean }> = [];

  for (let hour = 9; hour < 19; hour += 1) {
    const start = `${String(hour).padStart(2, "0")}:00`;
    const end = `${String(hour + 1).padStart(2, "0")}:00`;
    slots.push({
      startTime: start,
      endTime: end,
      available: !blocked.has(start)
    });
  }

  res.json({ date, tier, slots });
});
