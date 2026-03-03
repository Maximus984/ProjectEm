import {
  adminRoleValues,
  diagnosticRuntimeActionSchema,
  diagnosticTelemetryEventSchema,
  isAdminRole,
  type DiagnosticTelemetryEvent
} from "@projectm/contracts";
import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import type { RequestWithAuth } from "../../types.js";
import { decryptJson, encryptJson } from "../../utils/crypto.js";
import { writeAuditLog } from "../../utils/audit.js";
import { getAdminAnswersForGrade, getQuestionById, getQuestionsForGrade } from "./question-bank.js";
import { finalizeDiagnosticAttempt, type ComparisonAnswer, type DecryptedDiagnosticEvent } from "./scoring.js";

const runtimeSchema = z.object({
  action: diagnosticRuntimeActionSchema,
  grade: z.number().int().min(7).max(12).optional(),
  attempt_id: z.string().min(6).max(120).optional(),
  event: z.unknown().optional(),
  auth: z.string().optional(),
  reason: z.string().max(500).optional(),
  shuffle_questions: z.boolean().optional(),
  disable_break: z.boolean().optional(),
  strict_focus_mode: z.boolean().optional(),
  force_proctoring: z.boolean().optional()
});

const reassignSchema = z.object({
  reason: z.string().min(3).max(500),
  shuffleQuestions: z.boolean().default(true),
  disableBreak: z.boolean().default(false),
  strictFocusMode: z.boolean().default(false),
  forceProctoring: z.boolean().default(false)
});

const markReviewedSchema = z.object({
  verdict: z.enum(["valid_attempt", "reassign_required", "locked", "no_action"]),
  notes: z.string().min(3).max(4000)
});

const lockStudentSchema = z.object({
  reason: z.string().min(3).max(500),
  expiresAt: z.string().datetime().optional()
});

const parentReportSchema = z.object({
  deliveryChannel: z.enum(["EMAIL", "PORTAL"]).default("EMAIL"),
  parentEmail: z.string().email().optional()
});

const assignChildSchema = z.object({
  childId: z.string().uuid(),
  grade: z.number().int().min(7).max(12),
  label: z.string().min(2).max(120).optional()
});

const MAX_BREAKS_PER_ATTEMPT = 2;
const MAX_BREAK_SECONDS_PER_BREAK = 120;
const MAX_TOTAL_BREAK_SECONDS = MAX_BREAKS_PER_ATTEMPT * MAX_BREAK_SECONDS_PER_BREAK;

function getEventTime(event: DiagnosticTelemetryEvent): Date {
  switch (event.event_type) {
    case "attempt_start":
      return new Date(event.start_time);
    case "question_shown":
      return new Date(event.shown_time);
    case "first_interaction":
      return new Date(event.time);
    case "answer_save":
      return new Date(event.time);
    case "break_start":
      return new Date(event.start_time);
    case "break_end":
      return new Date(event.end_time);
    case "focus_change":
      return new Date(event.time);
    case "tool_usage":
      return new Date(event.time);
    case "attempt_submit":
      return new Date(event.end_time);
    default:
      return new Date();
  }
}

function normalizeDate(input: Date): Date {
  return Number.isNaN(input.getTime()) ? new Date() : input;
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

async function loadAttemptEvents(attemptId: string): Promise<DecryptedDiagnosticEvent[]> {
  const rows = await prisma.diagnosticEvent.findMany({
    where: { attemptId, deletedAt: null },
    orderBy: { eventAt: "asc" }
  });

  return rows
    .map((row) => {
      const decrypted = decryptJson(row.payloadEncrypted);
      const parsed = diagnosticTelemetryEventSchema.safeParse(decrypted);
      if (!parsed.success) {
        return null;
      }
      return {
        ...parsed.data,
        server_received_at: row.createdAt.toISOString()
      } as DecryptedDiagnosticEvent;
    })
    .filter((event): event is DecryptedDiagnosticEvent => Boolean(event));
}

async function appendDiagnosticEvent(params: {
  attemptId: string;
  actorUserId?: string;
  event: DiagnosticTelemetryEvent;
}) {
  await prisma.diagnosticEvent.create({
    data: {
      attemptId: params.attemptId,
      actorUserId: params.actorUserId,
      eventType: params.event.event_type,
      questionId:
        "question_id" in params.event ? params.event.question_id : null,
      eventAt: normalizeDate(getEventTime(params.event)),
      payloadEncrypted: encryptJson(params.event)
    }
  });
}

function getQuestionOrderForGrade(grade: number): string[] {
  return getQuestionsForGrade(grade).map((question) => question.question_id);
}

function encodeAssignedTestId(childId: string) {
  return `assigned_child_${childId}`;
}

function decodeAssignedChildId(testId: string): string | null {
  if (!testId.startsWith("assigned_child_")) {
    return null;
  }
  return testId.replace("assigned_child_", "") || null;
}

async function resolveFamilyChildIds(userId: string): Promise<string[]> {
  const memberships = await prisma.familyMember.findMany({
    where: {
      userId,
      deletedAt: null,
      family: { deletedAt: null }
    },
    select: { familyId: true }
  });

  if (!memberships.length) {
    return [];
  }

  const children = await prisma.child.findMany({
    where: {
      familyId: { in: memberships.map((item) => item.familyId) },
      deletedAt: null
    },
    select: { id: true }
  });

  return children.map((item) => item.id);
}

async function assertStudentNotLocked(studentUserId: string) {
  const lock = await prisma.diagnosticStudentLock.findFirst({
    where: {
      studentUserId,
      isActive: true,
      deletedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
    }
  });
  return !lock;
}

async function hasActiveAttempt(studentUserId: string) {
  const active = await prisma.diagnosticAttempt.findFirst({
    where: {
      studentUserId,
      status: "IN_PROGRESS",
      deletedAt: null
    },
    select: { id: true }
  });
  return Boolean(active);
}

const diagnosticRouter = Router();

diagnosticRouter.post("/diagnostic/runtime", requireAuth, validateBody(runtimeSchema), async (req: RequestWithAuth, res) => {
  const payload = req.body;

  if (payload.action === "get_questions") {
    if (!payload.grade) {
      res.status(400).json({ code: "VALIDATION_ERROR", message: "grade is required for get_questions." });
      return;
    }

    const allowed = await assertStudentNotLocked(req.auth!.userId);
    if (!allowed) {
      res.status(423).json({
        code: "STUDENT_LOCKED",
        message: "Diagnostic access is temporarily locked. Contact support."
      });
      return;
    }

    res.json({
      grade: payload.grade,
      questions: getQuestionsForGrade(payload.grade)
    });
    return;
  }

  if (payload.action === "get_answers") {
    if (!payload.grade) {
      res.status(400).json({ code: "VALIDATION_ERROR", message: "grade is required for get_answers." });
      return;
    }
    if (!isAdminRole(req.auth!.role) || payload.auth !== env.DIAGNOSTIC_ADMIN_KEY) {
      res.status(403).json({ code: "FORBIDDEN", message: "Admin key required." });
      return;
    }
    const activeAttempt = await hasActiveAttempt(req.auth!.userId);
    if (activeAttempt) {
      res.status(423).json({
        code: "ATTEMPT_IN_PROGRESS",
        message: "Answer key unavailable while a test attempt is in progress."
      });
      return;
    }

    res.json({
      grade: payload.grade,
      answers: getAdminAnswersForGrade(payload.grade)
    });
    return;
  }

  if (payload.action === "record_event") {
    const parsedEvent = diagnosticTelemetryEventSchema.safeParse(payload.event);
    if (!parsedEvent.success) {
      res.status(400).json({ code: "VALIDATION_ERROR", message: "Invalid telemetry event." });
      return;
    }
    const event = parsedEvent.data;

    let attempt = await prisma.diagnosticAttempt.findUnique({
      where: { attemptCode: event.attempt_id }
    });
    if (attempt?.deletedAt) {
      attempt = null;
    }

    if (!attempt) {
      if (event.event_type !== "attempt_start") {
        res.status(404).json({ code: "NOT_FOUND", message: "Attempt not found. Send attempt_start first." });
        return;
      }

      const allowed = await assertStudentNotLocked(req.auth!.userId);
      if (!allowed) {
        res.status(423).json({
          code: "STUDENT_LOCKED",
          message: "Diagnostic access is temporarily locked. Contact support."
        });
        return;
      }

      const questionOrder = getQuestionOrderForGrade(event.grade);
      attempt = await prisma.diagnosticAttempt.create({
        data: {
          attemptCode: event.attempt_id,
          studentUserId: req.auth!.userId,
          grade: event.grade,
          testId: event.test_id,
          startedAt: normalizeDate(new Date(event.start_time)),
          questionOrder,
          breakSummary: {
            count: 0,
            total_seconds: 0,
            breaks_exceeded: false,
            max_breaks_per_attempt: MAX_BREAKS_PER_ATTEMPT,
            max_break_seconds_per_break: MAX_BREAK_SECONDS_PER_BREAK,
            max_total_break_seconds: MAX_TOTAL_BREAK_SECONDS
          }
        }
      });
    } else {
      const isOwner = attempt.studentUserId === req.auth!.userId;
      if (!isOwner && !isAdminRole(req.auth!.role)) {
        res.status(403).json({ code: "FORBIDDEN", message: "No access to this attempt." });
        return;
      }

      if (attempt.status === "ASSIGNED" && event.event_type === "attempt_start") {
        attempt = await prisma.diagnosticAttempt.update({
          where: { id: attempt.id },
          data: {
            status: "IN_PROGRESS",
            startedAt: normalizeDate(new Date(event.start_time))
          }
        });
      } else if (attempt.status !== "IN_PROGRESS") {
        res.status(409).json({ code: "ATTEMPT_LOCKED", message: "Attempt is immutable after submission." });
        return;
      }
    }

    await appendDiagnosticEvent({
      attemptId: attempt.id,
      actorUserId: req.auth?.userId,
      event
    });

    res.status(201).json({ ok: true, attempt_id: attempt.attemptCode });
    return;
  }

  if (payload.action === "submit_attempt") {
    if (!payload.attempt_id) {
      res.status(400).json({ code: "VALIDATION_ERROR", message: "attempt_id is required for submit_attempt." });
      return;
    }

    const attempt = await prisma.diagnosticAttempt.findUnique({
      where: { attemptCode: payload.attempt_id }
    });
    if (!attempt || attempt.deletedAt) {
      res.status(404).json({ code: "NOT_FOUND", message: "Attempt not found." });
      return;
    }

    const isOwner = attempt.studentUserId === req.auth!.userId;
    if (!isOwner && !isAdminRole(req.auth!.role)) {
      res.status(403).json({ code: "FORBIDDEN", message: "No access to submit this attempt." });
      return;
    }

    if (attempt.status === "SUBMITTED") {
      const existing = attempt.finalSummary as Record<string, unknown> | null;
      res.json({
        attempt_id: attempt.attemptCode,
        ...(existing?.studentSummary as Record<string, unknown> | undefined)
      });
      return;
    }

    const events = await loadAttemptEvents(attempt.id);
    const questionIds = Array.isArray(attempt.questionOrder) ? attempt.questionOrder.map((id) => String(id)) : [];
    const questions = questionIds
      .map((id) => getQuestionById(id))
      .filter((question): question is NonNullable<typeof question> => Boolean(question));

    const priorAttempts = await prisma.diagnosticAttempt.findMany({
      where: {
        studentUserId: attempt.studentUserId,
        status: "SUBMITTED",
        deletedAt: null,
        id: { not: attempt.id }
      },
      orderBy: { createdAt: "asc" },
      select: {
        finalSummary: true
      }
    });

    const priorAttemptSummaries = priorAttempts
      .map((item) => item.finalSummary as Record<string, unknown> | null)
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => ({
        finalScore: Number(item.finalScore ?? 0),
        averageRatio: Number(item.averageRatio ?? 1),
        vocabularyComplexity: Number(item.vocabularyComplexity ?? 0),
        speedShiftIndex: Number(item.speedShiftIndex ?? 0)
      }));

    const candidateAttempts = await prisma.diagnosticAttempt.findMany({
      where: {
        status: "SUBMITTED",
        grade: attempt.grade,
        deletedAt: null,
        id: { not: attempt.id }
      },
      select: {
        attemptCode: true,
        studentUserId: true,
        answerStore: true
      },
      take: 120
    });

    const comparisonAnswers: ComparisonAnswer[] = [];
    for (const row of candidateAttempts) {
      const answerStore = row.answerStore as Record<string, { answer?: string }> | null;
      if (!answerStore) {
        continue;
      }
      for (const [questionId, answerPayload] of Object.entries(answerStore)) {
        const answerText = typeof answerPayload?.answer === "string" ? answerPayload.answer : "";
        if (answerText.trim().length === 0) {
          continue;
        }
        comparisonAnswers.push({
          attemptId: row.attemptCode,
          studentUserId: row.studentUserId,
          questionId,
          answerText
        });
      }
    }

    const finalized = finalizeDiagnosticAttempt({
      attemptStudentUserId: attempt.studentUserId,
      events,
      questions,
      priorAttemptSummaries,
      comparisonAnswers,
      maxBreaksPerAttempt: MAX_BREAKS_PER_ATTEMPT,
      maxBreakSecondsPerBreak: MAX_BREAK_SECONDS_PER_BREAK,
      maxTotalBreakSeconds: MAX_TOTAL_BREAK_SECONDS,
      focusChangeThreshold: 8,
      excludeBreaksFromTiming: true
    });

    await prisma.diagnosticAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
        answerStore: finalized.answerStore,
        breakSummary: finalized.breakSummary,
        focusSummary: finalized.focusSummary,
        finalSummary: {
          finalScore: finalized.finalScore,
          subjectBreakdown: finalized.subjectBreakdown,
          speedingScore: finalized.speedingScore,
          aiSimilarityScore: finalized.aiSimilarityScore,
          effortScore: finalized.effortScore,
          engagementScore: finalized.engagementScore,
          integrityScore: finalized.integrityScore,
          integrityBand: finalized.integrityBand,
          flagReason: finalized.flagReason,
          flaggedQuestions: finalized.flaggedQuestions,
          performanceTrend: finalized.performanceTrend,
          confidenceSummary: finalized.confidenceSummary,
          studentSummary: finalized.studentSummary,
          averageRatio:
            finalized.evidence.speeding.length > 0
              ? finalized.evidence.speeding.reduce((sum, item) => sum + item.ratio, 0) /
                finalized.evidence.speeding.length
              : 1,
          vocabularyComplexity:
            Object.values(finalized.answerStore)
              .map((item) => item.answer)
              .join(" ")
              .trim().length > 0
              ? Math.min(
                  1,
                  Object.values(finalized.answerStore)
                    .map((item) => item.answer.split(/\s+/).filter(Boolean).length)
                    .reduce((sum, count) => sum + count, 0) /
                    (Object.keys(finalized.answerStore).length * 40)
                )
              : 0
        },
        evidenceSummary: {
          ...finalized.evidence,
          flaggedQuestions: finalized.flaggedQuestions
        }
      }
    });

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "DIAGNOSTIC_ATTEMPT_SUBMITTED",
      entity: "DiagnosticAttempt",
      entityId: attempt.id,
      after: {
        attemptCode: attempt.attemptCode,
        finalScore: finalized.finalScore,
        integrityBand: finalized.integrityBand
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json({
      attempt_id: attempt.attemptCode,
      ...finalized.studentSummary
    });
    return;
  }

  if (payload.action === "reassign_attempt") {
    if (!payload.attempt_id || !payload.reason) {
      res.status(400).json({ code: "VALIDATION_ERROR", message: "attempt_id and reason are required." });
      return;
    }
    if (!isAdminRole(req.auth!.role) || payload.auth !== env.DIAGNOSTIC_ADMIN_KEY) {
      res.status(403).json({ code: "FORBIDDEN", message: "Admin key required." });
      return;
    }

    const existing = await prisma.diagnosticAttempt.findUnique({
      where: { attemptCode: payload.attempt_id }
    });
    if (!existing || existing.deletedAt) {
      res.status(404).json({ code: "NOT_FOUND", message: "Attempt not found." });
      return;
    }

    const originalOrder = Array.isArray(existing.questionOrder)
      ? existing.questionOrder.map((item) => String(item))
      : [];
    const nextOrder = payload.shuffle_questions ? shuffle(originalOrder) : originalOrder;
    const newAttemptCode = `${existing.attemptCode}_r${Date.now().toString(36)}`;

    const created = await prisma.$transaction(async (tx) => {
      await tx.diagnosticAttempt.update({
        where: { id: existing.id },
        data: {
          status: "ARCHIVED_REASSIGNED",
          archivedReason: payload.reason
        }
      });

      return tx.diagnosticAttempt.create({
        data: {
          attemptCode: newAttemptCode,
          studentUserId: existing.studentUserId,
          grade: existing.grade,
          testId: existing.testId,
          status: "IN_PROGRESS",
          startedAt: new Date(),
          questionOrder: nextOrder,
          reassignOfId: existing.id,
          disableBreak: payload.disable_break ?? false,
          strictFocusMode: payload.strict_focus_mode ?? false,
          forceProctoring: payload.force_proctoring ?? false,
          archivedReason: payload.reason,
          breakSummary: {
            count: 0,
            total_seconds: 0,
            breaks_exceeded: false,
            max_breaks_per_attempt: payload.disable_break ? 0 : MAX_BREAKS_PER_ATTEMPT,
            max_break_seconds_per_break: payload.disable_break ? 0 : MAX_BREAK_SECONDS_PER_BREAK,
            max_total_break_seconds: payload.disable_break ? 0 : MAX_TOTAL_BREAK_SECONDS
          }
        }
      });
    });

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "DIAGNOSTIC_ATTEMPT_REASSIGNED",
      entity: "DiagnosticAttempt",
      entityId: existing.id,
      after: {
        oldAttempt: existing.attemptCode,
        newAttempt: created.attemptCode,
        reason: payload.reason
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json({
      old_attempt_id: existing.attemptCode,
      new_attempt_id: created.attemptCode,
      status: "reassigned"
    });
    return;
  }

  res.status(400).json({ code: "UNSUPPORTED_ACTION", message: "Unsupported action." });
});

diagnosticRouter.get("/diagnostic/assignments", requireAuth, async (req: RequestWithAuth, res) => {
  const userId = req.auth!.userId;
  const role = req.auth!.role;

  const baseWhere = {
    deletedAt: null as Date | null,
    testId: {
      startsWith: "assigned_child_"
    }
  };

  let where: Record<string, unknown> = baseWhere;

  if (!isAdminRole(role)) {
    if (role === "CHILD") {
      const child = await prisma.child.findFirst({
        where: { userId, deletedAt: null },
        select: { id: true }
      });

      where = child
        ? {
            ...baseWhere,
            OR: [{ studentUserId: userId }, { testId: encodeAssignedTestId(child.id) }]
          }
        : {
            ...baseWhere,
            studentUserId: userId
          };
    } else if (["FAMILY", "PARENT"].includes(role)) {
      const childIds = await resolveFamilyChildIds(userId);
      where = childIds.length
        ? {
            ...baseWhere,
            OR: [{ studentUserId: userId }, ...childIds.map((childId) => ({ testId: encodeAssignedTestId(childId) }))]
          }
        : {
            ...baseWhere,
            studentUserId: userId
          };
    } else {
      where = {
        ...baseWhere,
        studentUserId: userId
      };
    }
  }

  const attempts = await prisma.diagnosticAttempt.findMany({
    where,
    include: {
      student: {
        select: { id: true, email: true, firstName: true, lastName: true }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 250
  });

  const childIds = attempts
    .map((attempt) => decodeAssignedChildId(attempt.testId))
    .filter((item): item is string => Boolean(item));
  const childRows =
    childIds.length === 0
      ? []
      : await prisma.child.findMany({
          where: { id: { in: Array.from(new Set(childIds)) }, deletedAt: null },
          select: { id: true, firstName: true, lastName: true, gradeLevel: true, familyId: true }
        });
  const childById = new Map(childRows.map((child) => [child.id, child]));

  res.json({
    assignments: attempts.map((attempt) => {
      const childId = decodeAssignedChildId(attempt.testId);
      const child = childId ? childById.get(childId) : null;
      return {
        assignmentId: attempt.id,
        attemptId: attempt.attemptCode,
        grade: attempt.grade,
        label: attempt.archivedReason ?? `Grade ${attempt.grade} Diagnostic`,
        status: attempt.status,
        child: child
          ? {
              id: child.id,
              firstName: child.firstName,
              lastName: child.lastName,
              gradeLevel: child.gradeLevel,
              familyId: child.familyId
            }
          : null,
        assignedTo: {
          userId: attempt.student.id,
          email: attempt.student.email,
          firstName: attempt.student.firstName,
          lastName: attempt.student.lastName
        },
        assignedAt: attempt.createdAt,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        isStartable: attempt.status === "ASSIGNED" || attempt.status === "IN_PROGRESS"
      };
    })
  });
});

diagnosticRouter.post(
  "/diagnostic/admin/assign-child",
  requireAuth,
  requireRole([...adminRoleValues]),
  validateBody(assignChildSchema),
  async (req: RequestWithAuth, res) => {
    const payload = req.body;

    const child = await prisma.child.findUnique({
      where: { id: payload.childId },
      include: {
        family: {
          include: {
            members: {
              where: { deletedAt: null },
              include: {
                user: {
                  select: { id: true, role: true, firstName: true, lastName: true, email: true }
                }
              }
            }
          }
        }
      }
    });

    if (!child || child.deletedAt) {
      res.status(404).json({ code: "NOT_FOUND", message: "Child not found." });
      return;
    }

    let studentUserId = child.userId;
    if (!studentUserId) {
      const parentMember = child.family.members.find((member) =>
        ["FAMILY", "PARENT"].includes(member.user.role)
      );
      if (!parentMember) {
        res.status(400).json({
          code: "NO_TARGET_ACCOUNT",
          message: "Child has no linked child login and family has no parent account to receive assignment."
        });
        return;
      }
      studentUserId = parentMember.user.id;
    }

    const attemptCode = `asg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const created = await prisma.diagnosticAttempt.create({
      data: {
        attemptCode,
        studentUserId,
        grade: payload.grade,
        testId: encodeAssignedTestId(child.id),
        status: "ASSIGNED",
        startedAt: new Date(),
        questionOrder: getQuestionOrderForGrade(payload.grade),
        archivedReason: payload.label ?? `Assigned Grade ${payload.grade} diagnostic`,
        breakSummary: {
          count: 0,
          total_seconds: 0,
          breaks_exceeded: false,
          max_breaks_per_attempt: MAX_BREAKS_PER_ATTEMPT,
          max_break_seconds_per_break: MAX_BREAK_SECONDS_PER_BREAK,
          max_total_break_seconds: MAX_TOTAL_BREAK_SECONDS
        }
      },
      include: {
        student: {
          select: { id: true, email: true, firstName: true, lastName: true }
        }
      }
    });

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "DIAGNOSTIC_ASSIGNED_TO_CHILD",
      entity: "DiagnosticAttempt",
      entityId: created.id,
      after: {
        attemptCode: created.attemptCode,
        childId: child.id,
        grade: created.grade,
        studentUserId: created.studentUserId
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.status(201).json({
      assignmentId: created.id,
      attemptId: created.attemptCode,
      grade: created.grade,
      status: created.status,
      label: created.archivedReason,
      child: {
        id: child.id,
        firstName: child.firstName,
        lastName: child.lastName,
        gradeLevel: child.gradeLevel,
        hasChildLogin: Boolean(child.userId)
      },
      assignedTo: {
        userId: created.student.id,
        email: created.student.email,
        firstName: created.student.firstName,
        lastName: created.student.lastName
      },
      assignedAt: created.createdAt
    });
  }
);

diagnosticRouter.get("/diagnostic/attempts/:attemptCode/results-summary", requireAuth, async (req: RequestWithAuth, res) => {
  const attempt = await prisma.diagnosticAttempt.findUnique({
    where: { attemptCode: req.params.attemptCode }
  });
  if (!attempt || attempt.deletedAt) {
    res.status(404).json({ code: "NOT_FOUND", message: "Attempt not found." });
    return;
  }
  if (attempt.studentUserId !== req.auth!.userId && !isAdminRole(req.auth!.role)) {
    res.status(403).json({ code: "FORBIDDEN", message: "No access to this attempt." });
    return;
  }
  const summary = (attempt.finalSummary as Record<string, unknown> | null)?.studentSummary as
    | Record<string, unknown>
    | undefined;
  if (!summary) {
    res.status(400).json({ code: "NOT_READY", message: "Attempt has not been submitted." });
    return;
  }

  const confidenceLine =
    typeof summary.confidence_accuracy_score === "number"
      ? ` Confidence accuracy score is ${summary.confidence_accuracy_score}.`
      : "";
  const text = `Diagnostic complete. Academic score is ${summary.final_score}. Engagement score is ${summary.engagement_score}.${confidenceLine} Recommended next step is ${summary.recommendation}.`;
  res.json({
    attempt_id: attempt.attemptCode,
    summary_text: text
  });
});

diagnosticRouter.get(
  "/diagnostic/admin/attempts/:attemptCode",
  requireAuth,
  requireRole([...adminRoleValues]),
  async (req: RequestWithAuth, res) => {
    const attempt = await prisma.diagnosticAttempt.findUnique({
      where: { attemptCode: req.params.attemptCode },
      include: {
        student: { select: { id: true, email: true, firstName: true, lastName: true } }
      }
    });
    if (!attempt || attempt.deletedAt) {
      res.status(404).json({ code: "NOT_FOUND", message: "Attempt not found." });
      return;
    }

    const finalSummary = (attempt.finalSummary as Record<string, unknown> | null) ?? {};
    const evidence = (attempt.evidenceSummary as Record<string, unknown> | null) ?? {};
    const breakSummary = (attempt.breakSummary as Record<string, unknown> | null) ?? {};
    const focusSummary = (attempt.focusSummary as Record<string, unknown> | null) ?? {};

    res.json({
      student_id: attempt.student.id,
      student_name: `${attempt.student.firstName} ${attempt.student.lastName}`,
      student_email: attempt.student.email,
      attempt_id: attempt.attemptCode,
      final_score: Number(finalSummary.finalScore ?? 0),
      speeding_score: Number(finalSummary.speedingScore ?? 0),
      ai_similarity_score: Number(finalSummary.aiSimilarityScore ?? 0),
      effort_score: Number(finalSummary.effortScore ?? 0),
      engagement_score: Number(finalSummary.engagementScore ?? 0),
      integrity_score: Number(finalSummary.integrityScore ?? 0),
      integrity_band: finalSummary.integrityBand ?? "NORMAL",
      flag_reason: finalSummary.flagReason ?? "No action required",
      flagged_questions: (evidence.flaggedQuestions ?? []) as unknown[],
      break_summary: breakSummary,
      focus_summary: focusSummary,
      performance_trend: finalSummary.performanceTrend ?? {},
      evidence
    });
  }
);

diagnosticRouter.post(
  "/diagnostic/admin/attempts/:attemptCode/reassign",
  requireAuth,
  requireRole([...adminRoleValues]),
  validateBody(reassignSchema),
  async (req: RequestWithAuth, res) => {
    const existing = await prisma.diagnosticAttempt.findUnique({
      where: { attemptCode: req.params.attemptCode }
    });
    if (!existing || existing.deletedAt) {
      res.status(404).json({ code: "NOT_FOUND", message: "Attempt not found." });
      return;
    }

    const originalOrder = Array.isArray(existing.questionOrder)
      ? existing.questionOrder.map((item) => String(item))
      : [];
    const order = req.body.shuffleQuestions ? shuffle(originalOrder) : originalOrder;
    const newAttemptCode = `${existing.attemptCode}_r${Date.now().toString(36)}`;

    const created = await prisma.$transaction(async (tx) => {
      await tx.diagnosticAttempt.update({
        where: { id: existing.id },
        data: {
          status: "ARCHIVED_REASSIGNED",
          archivedReason: req.body.reason
        }
      });

      return tx.diagnosticAttempt.create({
        data: {
          attemptCode: newAttemptCode,
          studentUserId: existing.studentUserId,
          grade: existing.grade,
          testId: existing.testId,
          status: "IN_PROGRESS",
          startedAt: new Date(),
          questionOrder: order,
          reassignOfId: existing.id,
          disableBreak: req.body.disableBreak,
          strictFocusMode: req.body.strictFocusMode,
          forceProctoring: req.body.forceProctoring,
          archivedReason: req.body.reason
        }
      });
    });

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "DIAGNOSTIC_REASSIGN_ADMIN",
      entity: "DiagnosticAttempt",
      entityId: existing.id,
      after: {
        oldAttempt: existing.attemptCode,
        newAttempt: created.attemptCode,
        reason: req.body.reason
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json({
      old_attempt_id: existing.attemptCode,
      new_attempt_id: created.attemptCode,
      status: "reassigned"
    });
  }
);

diagnosticRouter.post(
  "/diagnostic/admin/attempts/:attemptCode/mark_reviewed",
  requireAuth,
  requireRole([...adminRoleValues]),
  validateBody(markReviewedSchema),
  async (req: RequestWithAuth, res) => {
    const attempt = await prisma.diagnosticAttempt.findUnique({
      where: { attemptCode: req.params.attemptCode }
    });
    if (!attempt || attempt.deletedAt) {
      res.status(404).json({ code: "NOT_FOUND", message: "Attempt not found." });
      return;
    }

    await prisma.diagnosticAttempt.update({
      where: { id: attempt.id },
      data: {
        reviewerId: req.auth!.userId,
        reviewedAt: new Date(),
        reviewVerdict: req.body.verdict,
        reviewNotes: req.body.notes
      }
    });

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "DIAGNOSTIC_MARK_REVIEWED",
      entity: "DiagnosticAttempt",
      entityId: attempt.id,
      after: {
        verdict: req.body.verdict
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json({ ok: true });
  }
);

diagnosticRouter.post(
  "/diagnostic/admin/attempts/:attemptCode/send_parent_report",
  requireAuth,
  requireRole([...adminRoleValues]),
  validateBody(parentReportSchema),
  async (req: RequestWithAuth, res) => {
    const attempt = await prisma.diagnosticAttempt.findUnique({
      where: { attemptCode: req.params.attemptCode }
    });
    if (!attempt || attempt.deletedAt) {
      res.status(404).json({ code: "NOT_FOUND", message: "Attempt not found." });
      return;
    }
    const finalSummary = (attempt.finalSummary as Record<string, unknown> | null) ?? {};
    const studentSummary = (finalSummary.studentSummary as Record<string, unknown> | null) ?? {};

    const report = {
      student_id: attempt.studentUserId,
      attempt_id: attempt.attemptCode,
      academic_score: studentSummary.final_score ?? 0,
      subject_breakdown: studentSummary.subject_breakdown ?? {},
      engagement_score: studentSummary.engagement_score ?? 0,
      confidence_accuracy_score: studentSummary.confidence_accuracy_score ?? 0,
      overconfidence_index: studentSummary.overconfidence_index ?? 0,
      integrity_status:
        Number(finalSummary.integrityScore ?? 0) > 20 ? "Flagged for Review" : "No Review Needed",
      recommendation: studentSummary.recommendation ?? "Continue regular learning plan.",
      attempt_history_comparison: {
        previous_score: null,
        current_score: studentSummary.final_score ?? 0,
        trend: "baseline"
      },
      notes:
        "This diagnostic is one data point. If review is needed, a staff member will discuss next steps."
    };

    const saved = await prisma.diagnosticParentReport.create({
      data: {
        attemptId: attempt.id,
        studentUserId: attempt.studentUserId,
        generatedById: req.auth?.userId,
        deliveryChannel: req.body.deliveryChannel,
        deliveryStatus: "GENERATED",
        payload: report
      }
    });

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "DIAGNOSTIC_PARENT_REPORT_GENERATED",
      entity: "DiagnosticParentReport",
      entityId: saved.id,
      after: {
        attempt: attempt.attemptCode,
        channel: req.body.deliveryChannel
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json({
      ok: true,
      report_id: saved.id,
      delivery_status: "queued"
    });
  }
);

diagnosticRouter.post(
  "/diagnostic/admin/attempts/:attemptCode/lock_student",
  requireAuth,
  requireRole([...adminRoleValues]),
  validateBody(lockStudentSchema),
  async (req: RequestWithAuth, res) => {
    const attempt = await prisma.diagnosticAttempt.findUnique({
      where: { attemptCode: req.params.attemptCode }
    });
    if (!attempt || attempt.deletedAt) {
      res.status(404).json({ code: "NOT_FOUND", message: "Attempt not found." });
      return;
    }

    const lock = await prisma.diagnosticStudentLock.upsert({
      where: { studentUserId: attempt.studentUserId },
      create: {
        studentUserId: attempt.studentUserId,
        lockedById: req.auth?.userId,
        reason: req.body.reason,
        isActive: true,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined
      },
      update: {
        lockedById: req.auth?.userId,
        reason: req.body.reason,
        isActive: true,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
        deletedAt: null
      }
    });

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "DIAGNOSTIC_STUDENT_LOCKED",
      entity: "DiagnosticStudentLock",
      entityId: lock.id,
      after: {
        studentUserId: attempt.studentUserId,
        reason: lock.reason
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json({
      ok: true,
      locked: true,
      student_id: attempt.studentUserId
    });
  }
);

export { diagnosticRouter };
