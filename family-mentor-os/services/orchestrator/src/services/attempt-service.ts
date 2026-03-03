import type { PrismaClient, AttemptStatus } from "@prisma/client";
import type { Redis } from "ioredis";
import type { Server as SocketServer } from "socket.io";
import { compareWithAiService } from "./ai-check-client";
import { calculateRiskScore } from "./risk";
import { applyBreakEnd, breakCountdownSeconds, computeRemainingSeconds, isAutoSubmitDue, shouldFlagSpeeding } from "./timing";

type AuthContext = {
  userId: string;
  tenantId: string;
  role: string;
};

const lockTtlSeconds = 60 * 60;

function lockKey(tenantId: string, testId: string, userId: string) {
  return `attempt_lock:${tenantId}:${testId}:${userId}`;
}

function normalizeAnswer(value: string) {
  return value.trim().toLowerCase();
}

function isCorrectAnswer(expected: string, actual: string) {
  if (!expected.trim()) {
    return false;
  }

  const expectedValue = normalizeAnswer(expected);
  const actualValue = normalizeAnswer(actual);

  if (expectedValue.includes("|")) {
    return expectedValue.split("|").map((item) => item.trim()).includes(actualValue);
  }

  return expectedValue === actualValue;
}

export class AttemptService {
  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
    private io: SocketServer,
    private breakDurationSeconds: number
  ) {}

  async startAttempt(testId: string, auth: AuthContext, requestedDuration?: number) {
    const test = await this.prisma.test.findFirst({
      where: { id: testId, tenantId: auth.tenantId },
      include: {
        sections: {
          include: {
            items: {
              orderBy: { order: "asc" }
            }
          },
          orderBy: { order: "asc" }
        }
      }
    });

    if (!test) {
      throw new Error("Test not found");
    }

    const activeAttempt = await this.prisma.testAttempt.findFirst({
      where: {
        tenantId: auth.tenantId,
        testId,
        studentId: auth.userId,
        status: { in: ["IN_PROGRESS", "BREAK"] }
      }
    });

    if (activeAttempt) {
      throw new Error("An active attempt already exists");
    }

    const key = lockKey(auth.tenantId, testId, auth.userId);
    const lockResult = await this.redis.set(key, "1", "NX", "EX", lockTtlSeconds);
    if (!lockResult) {
      throw new Error("Simultaneous session detected");
    }

    const attempt = await this.prisma.testAttempt.create({
      data: {
        tenantId: auth.tenantId,
        testId,
        studentId: auth.userId,
        startedAt: new Date(),
        durationSeconds: requestedDuration ?? test.totalSeconds,
        status: "IN_PROGRESS"
      }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: auth.tenantId,
        attemptId: attempt.id,
        actorUserId: auth.userId,
        action: "ATTEMPT_STARTED",
        after: {
          testId,
          durationSeconds: attempt.durationSeconds
        }
      }
    });

    return {
      attempt,
      test: {
        id: test.id,
        title: test.title,
        sections: test.sections
      }
    };
  }

  async saveAnswer(testId: string, auth: AuthContext, payload: { attemptId: string; itemId: string; answer: string; timeSpentSec: number }) {
    const attempt = await this.assertAttemptAccess(payload.attemptId, testId, auth);

    if (attempt.status === "BREAK") {
      throw new Error("Attempt is currently on break");
    }
    if (attempt.status === "SUBMITTED" || attempt.status === "AUTO_SUBMITTED") {
      throw new Error("Attempt already submitted");
    }

    const item = await this.prisma.item.findFirst({
      where: {
        id: payload.itemId,
        section: {
          testId
        }
      }
    });

    if (!item) {
      throw new Error("Item not found for this test");
    }

    const correct = isCorrectAnswer(item.correctAnswer, payload.answer);

    const answer = await this.prisma.answer.upsert({
      where: {
        attemptId_itemId: {
          attemptId: payload.attemptId,
          itemId: payload.itemId
        }
      },
      update: {
        answerText: payload.answer,
        isCorrect: correct,
        savedAt: new Date(),
        timeSpentSec: payload.timeSpentSec
      },
      create: {
        tenantId: auth.tenantId,
        attemptId: payload.attemptId,
        itemId: payload.itemId,
        answerText: payload.answer,
        isCorrect: correct,
        timeSpentSec: payload.timeSpentSec
      }
    });

    if (payload.timeSpentSec <= 5) {
      await this.recordBehavior(auth.tenantId, payload.attemptId, "RAPID_ANSWERING", {
        itemId: payload.itemId,
        timeSpentSec: payload.timeSpentSec
      });
    }

    return answer;
  }

  async requestBreak(testId: string, auth: AuthContext, attemptId: string) {
    const attempt = await this.assertAttemptAccess(attemptId, testId, auth);

    if (attempt.breakUsed) {
      throw new Error("Break already used for this attempt");
    }

    if (attempt.status !== "IN_PROGRESS") {
      throw new Error("Break can only be requested during active attempt");
    }

    const now = new Date();
    const breakEndsAt = new Date(now.getTime() + this.breakDurationSeconds * 1000);

    const updated = await this.prisma.testAttempt.update({
      where: { id: attemptId },
      data: {
        breakUsed: true,
        status: "BREAK",
        breakStartedAt: now,
        breakEndsAt
      }
    });

    await this.recordBehavior(auth.tenantId, attemptId, "BREAK_REQUEST", {
      breakEndsAt
    });

    this.io.to(attemptId).emit("break_started", {
      attemptId,
      breakEndsAt
    });

    return updated;
  }

  async resumeBreak(testId: string, auth: AuthContext, attemptId: string, automated = false) {
    const attempt = await this.assertAttemptAccess(attemptId, testId, auth);

    if (attempt.status !== "BREAK") {
      throw new Error("Attempt is not on break");
    }

    const now = new Date();
    const pausedSeconds = applyBreakEnd(
      {
        pausedSeconds: attempt.pausedSeconds,
        breakStartedAt: attempt.breakStartedAt
      },
      now
    );

    const updated = await this.prisma.testAttempt.update({
      where: { id: attemptId },
      data: {
        status: "IN_PROGRESS",
        breakStartedAt: null,
        breakEndsAt: null,
        pausedSeconds
      }
    });

    await this.recordBehavior(auth.tenantId, attemptId, "RESUME", {
      automated
    });

    this.io.to(attemptId).emit("break_ended", { attemptId, automated });

    return updated;
  }

  async heartbeat(testId: string, auth: AuthContext, payload: { attemptId: string; eventType: string; metadata?: Record<string, unknown> }) {
    const attempt = await this.assertAttemptAccess(payload.attemptId, testId, auth);
    const now = new Date();

    if (payload.eventType === "tab_blur") {
      await this.prisma.testAttempt.update({
        where: { id: attempt.id },
        data: { lastBlurAt: now }
      });
      await this.recordBehavior(auth.tenantId, attempt.id, "TAB_BLUR", payload.metadata);
    } else if (payload.eventType === "tab_focus") {
      let outOfFocusSeconds = attempt.outOfFocusSeconds;
      if (attempt.lastBlurAt) {
        outOfFocusSeconds += Math.max(0, Math.floor((now.getTime() - attempt.lastBlurAt.getTime()) / 1000));
      }
      await this.prisma.testAttempt.update({
        where: { id: attempt.id },
        data: {
          lastBlurAt: null,
          outOfFocusSeconds
        }
      });
      await this.recordBehavior(auth.tenantId, attempt.id, "TAB_FOCUS", payload.metadata);
    } else if (payload.eventType === "copy_paste") {
      await this.recordBehavior(auth.tenantId, attempt.id, "COPY_PASTE", payload.metadata);
    } else {
      await this.recordBehavior(auth.tenantId, attempt.id, "HEARTBEAT", payload.metadata);
    }

    const remaining = computeRemainingSeconds(
      {
        startedAt: attempt.startedAt,
        durationSeconds: attempt.durationSeconds,
        pausedSeconds: attempt.pausedSeconds,
        breakStartedAt: attempt.breakStartedAt,
        breakEndsAt: attempt.breakEndsAt
      },
      now
    );

    this.io.to(attempt.id).emit("tick", {
      attemptId: attempt.id,
      remainingSeconds: remaining
    });

    return { remainingSeconds: remaining };
  }

  async submitAttempt(testId: string, auth: AuthContext, attemptId: string, auto = false) {
    const attempt = await this.assertAttemptAccess(attemptId, testId, auth);

    if (attempt.status === "SUBMITTED" || attempt.status === "AUTO_SUBMITTED") {
      return attempt;
    }

    const now = new Date();

    let outOfFocusSeconds = attempt.outOfFocusSeconds;
    if (attempt.lastBlurAt) {
      outOfFocusSeconds += Math.max(0, Math.floor((now.getTime() - attempt.lastBlurAt.getTime()) / 1000));
    }

    const [answers, totalItems] = await Promise.all([
      this.prisma.answer.findMany({ where: { attemptId } }),
      this.prisma.item.count({ where: { section: { testId } } })
    ]);

    const correctCount = answers.filter((item) => item.isCorrect).length;
    const scorePercent = totalItems > 0 ? Math.round((correctCount / totalItems) * 100) : 0;

    const status: AttemptStatus = auto ? "AUTO_SUBMITTED" : "SUBMITTED";

    const updated = await this.prisma.testAttempt.update({
      where: { id: attempt.id },
      data: {
        status,
        submittedAt: now,
        autoSubmittedAt: auto ? now : null,
        scorePercent,
        outOfFocusSeconds,
        lastBlurAt: null
      }
    });

    await this.recordBehavior(auth.tenantId, attempt.id, "SUBMIT", {
      auto
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: auth.tenantId,
        attemptId: attempt.id,
        actorUserId: auth.userId,
        action: auto ? "AUTO_SUBMIT" : "MANUAL_SUBMIT",
        after: {
          scorePercent,
          correctCount,
          totalItems
        }
      }
    });

    await this.redis.del(lockKey(auth.tenantId, testId, auth.userId));
    await this.runAiCheck(updated.id, auth.tenantId);

    this.io.to(attempt.id).emit(auto ? "auto_submit" : "tick", {
      attemptId: attempt.id,
      status
    });

    return updated;
  }

  async getResults(attemptId: string, auth: AuthContext) {
    const attempt = await this.prisma.testAttempt.findFirst({
      where: { id: attemptId, tenantId: auth.tenantId },
      include: {
        test: {
          include: {
            sections: {
              include: {
                items: {
                  orderBy: { order: "asc" }
                }
              },
              orderBy: { order: "asc" }
            }
          }
        },
        answers: true,
        aiCheck: true,
        behaviorEvents: {
          orderBy: { occurredAt: "asc" }
        }
      }
    });

    if (!attempt) {
      throw new Error("Attempt not found");
    }

    if (attempt.studentId !== auth.userId && !["PARENT", "MENTOR", "OWNER", "MANAGER", "ADMIN"].includes(auth.role)) {
      throw new Error("Forbidden");
    }

    const answerMap = new Map(attempt.answers.map((a) => [a.itemId, a]));

    const sections = attempt.test.sections.map((section) => {
      const items = section.items.map((item) => {
        const answer = answerMap.get(item.id);
        return {
          itemId: item.id,
          prompt: item.prompt,
          correctAnswer: item.correctAnswer,
          answer: answer?.answerText ?? null,
          isCorrect: answer?.isCorrect ?? false,
          timeSpentSec: answer?.timeSpentSec ?? 0
        };
      });

      return {
        sectionId: section.id,
        title: section.title,
        correctCount: items.filter((item) => item.isCorrect).length,
        total: items.length,
        items
      };
    });

    return {
      attemptId: attempt.id,
      testId: attempt.testId,
      status: attempt.status,
      scorePercent: attempt.scorePercent ?? 0,
      riskScore: attempt.aiCheck?.riskScore ?? null,
      aiCheck: attempt.aiCheck,
      outOfFocusSeconds: attempt.outOfFocusSeconds,
      sections
    };
  }

  async compareSubmission(attemptId: string, auth: AuthContext) {
    const attempt = await this.prisma.testAttempt.findFirst({
      where: { id: attemptId, tenantId: auth.tenantId }
    });

    if (!attempt) {
      throw new Error("Attempt not found");
    }

    const aiCheck = await this.runAiCheck(attemptId, auth.tenantId);

    this.io.to(attemptId).emit("ai_flags", {
      attemptId,
      riskScore: aiCheck.riskScore,
      flags: [
        aiCheck.similarityScore > 70 ? "high_similarity" : null,
        aiCheck.stylometryScore > 70 ? "stylometry_shift" : null,
        aiCheck.speedingFlag > 70 ? "speeding" : null
      ].filter(Boolean)
    });

    return aiCheck;
  }

  async overrideAttempt(attemptId: string, auth: AuthContext, verdict: "APPROVED" | "FLAGGED" | "CLEARED", note: string) {
    const attempt = await this.prisma.testAttempt.findFirst({
      where: { id: attemptId, tenantId: auth.tenantId }
    });

    if (!attempt) {
      throw new Error("Attempt not found");
    }

    if (!["MENTOR", "OWNER", "MANAGER", "ADMIN"].includes(auth.role)) {
      throw new Error("Forbidden");
    }

    const log = await this.prisma.auditLog.create({
      data: {
        tenantId: auth.tenantId,
        attemptId,
        actorUserId: auth.userId,
        action: "HUMAN_OVERRIDE",
        verdict,
        note
      }
    });

    return log;
  }

  async heartbeatSweep() {
    const attempts = await this.prisma.testAttempt.findMany({
      where: {
        status: { in: ["IN_PROGRESS", "BREAK"] },
        submittedAt: null
      }
    });

    for (const attempt of attempts) {
      const now = new Date();

      if (attempt.status === "BREAK" && attempt.breakEndsAt) {
        const breakRemaining = breakCountdownSeconds(attempt.breakEndsAt, now);
        this.io.to(attempt.id).emit("break_countdown", {
          attemptId: attempt.id,
          remainingSeconds: breakRemaining
        });

        if (breakRemaining <= 0) {
          await this.resumeBreak(attempt.testId, {
            userId: attempt.studentId,
            tenantId: attempt.tenantId,
            role: "STUDENT"
          }, attempt.id, true);
          continue;
        }
      }

      const remaining = computeRemainingSeconds(
        {
          startedAt: attempt.startedAt,
          durationSeconds: attempt.durationSeconds,
          pausedSeconds: attempt.pausedSeconds,
          breakStartedAt: attempt.breakStartedAt,
          breakEndsAt: attempt.breakEndsAt
        },
        now
      );

      this.io.to(attempt.id).emit("tick", {
        attemptId: attempt.id,
        remainingSeconds: remaining
      });

      if (
        isAutoSubmitDue(
          {
            startedAt: attempt.startedAt,
            durationSeconds: attempt.durationSeconds,
            pausedSeconds: attempt.pausedSeconds,
            breakStartedAt: attempt.breakStartedAt,
            breakEndsAt: attempt.breakEndsAt
          },
          now
        )
      ) {
        await this.submitAttempt(attempt.testId, {
          userId: attempt.studentId,
          tenantId: attempt.tenantId,
          role: "STUDENT"
        }, attempt.id, true);
      }
    }
  }

  private async runAiCheck(attemptId: string, tenantId: string) {
    const answers = await this.prisma.answer.findMany({
      where: { attemptId },
      include: {
        item: {
          select: {
            prompt: true
          }
        }
      },
      orderBy: { savedAt: "asc" }
    });

    const attempt = await this.prisma.testAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt) {
      throw new Error("Attempt not found");
    }

    const currentText = answers.map((answer) => `${answer.item.prompt}\n${answer.answerText}`).join("\n\n");

    const priorRows = await this.prisma.answer.findMany({
      where: {
        attempt: {
          tenantId,
          studentId: attempt.studentId,
          id: { not: attemptId },
          status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] }
        }
      },
      take: 100,
      orderBy: { savedAt: "desc" }
    });

    const cohortRows = await this.prisma.answer.findMany({
      where: {
        attempt: {
          tenantId,
          testId: attempt.testId,
          studentId: { not: attempt.studentId },
          status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] }
        }
      },
      take: 200,
      orderBy: { savedAt: "desc" }
    });

    const ai = await compareWithAiService({
      text: currentText,
      prior_submissions: priorRows.map((row) => row.answerText),
      cohort_submissions: cohortRows.map((row) => row.answerText)
    });

    const rapidRuns = await this.prisma.behaviorEvent.count({
      where: { attemptId, eventType: "RAPID_ANSWERING" }
    });

    const pasteEvents = await this.prisma.behaviorEvent.count({
      where: { attemptId, eventType: "COPY_PASTE" }
    });

    const avgTime = answers.length
      ? answers.reduce((sum, answer) => sum + answer.timeSpentSec, 0) / answers.length
      : 999;

    const speeding = shouldFlagSpeeding({
      averageSecondsPerQuestion: avgTime,
      thresholdSeconds: 12,
      perfectScore: answers.length > 0 && answers.every((row) => row.isCorrect),
      totalDurationSeconds: attempt.durationSeconds,
      rapidRuns,
      baselineRatio: 1
    })
      ? 80
      : 10;

    const tabBlurScore = Math.min(100, Math.round((attempt.outOfFocusSeconds / Math.max(1, attempt.durationSeconds)) * 100));

    const riskScore = calculateRiskScore({
      similarityScore: ai.similarity_score,
      stylometryScore: ai.stylometry_score,
      speedingFlag: speeding,
      tabBlurScore,
      webcamFlag: 0,
      pasteEvents
    });

    const record = await this.prisma.aiCheck.upsert({
      where: { attemptId },
      update: {
        similarityScore: ai.similarity_score,
        stylometryScore: ai.stylometry_score,
        aiGeneratedProbability: ai.ai_generated_probability,
        speedingFlag: speeding,
        tabBlurScore,
        webcamFlag: 0,
        pasteEvents,
        riskScore,
        explanation: ai.explanation
      },
      create: {
        tenantId,
        attemptId,
        similarityScore: ai.similarity_score,
        stylometryScore: ai.stylometry_score,
        aiGeneratedProbability: ai.ai_generated_probability,
        speedingFlag: speeding,
        tabBlurScore,
        webcamFlag: 0,
        pasteEvents,
        riskScore,
        explanation: ai.explanation
      }
    });

    await this.prisma.testAttempt.update({
      where: { id: attemptId },
      data: { riskScore }
    });

    return record;
  }

  private async assertAttemptAccess(attemptId: string, testId: string, auth: AuthContext) {
    const attempt = await this.prisma.testAttempt.findFirst({
      where: {
        id: attemptId,
        testId,
        tenantId: auth.tenantId
      }
    });

    if (!attempt) {
      throw new Error("Attempt not found");
    }

    const canAccess =
      attempt.studentId === auth.userId ||
      ["PARENT", "MENTOR", "OWNER", "MANAGER", "ADMIN"].includes(auth.role);

    if (!canAccess) {
      throw new Error("Forbidden");
    }

    return attempt;
  }

  private async recordBehavior(tenantId: string, attemptId: string, eventType: "TAB_BLUR" | "TAB_FOCUS" | "COPY_PASTE" | "RAPID_ANSWERING" | "BREAK_REQUEST" | "RESUME" | "SUBMIT" | "HEARTBEAT", metadata?: Record<string, unknown>) {
    await this.prisma.behaviorEvent.create({
      data: {
        tenantId,
        attemptId,
        eventType,
        metadata
      }
    });
  }
}
