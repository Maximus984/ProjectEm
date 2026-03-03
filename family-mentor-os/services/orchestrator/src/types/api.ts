import { z } from "zod";

export const startTestSchema = z.object({
  durationSeconds: z.number().int().positive().optional()
});

export const answerSchema = z.object({
  attemptId: z.string().min(1),
  itemId: z.string().min(1),
  answer: z.string().min(1),
  timeSpentSec: z.number().int().nonnegative().default(0)
});

export const breakSchema = z.object({
  attemptId: z.string().min(1)
});

export const heartbeatSchema = z.object({
  attemptId: z.string().min(1),
  eventType: z.enum(["tab_blur", "tab_focus", "copy_paste", "heartbeat"]),
  metadata: z.record(z.unknown()).optional()
});

export const submitSchema = z.object({
  attemptId: z.string().min(1)
});

export const overrideSchema = z.object({
  verdict: z.enum(["APPROVED", "FLAGGED", "CLEARED"]),
  note: z.string().min(3)
});
