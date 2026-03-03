import { Router } from "express";
import { adminRoleValues, familyRoleValues } from "@projectm/contracts";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { writeAuditLog } from "../../utils/audit.js";

const attendanceStatusSchema = z.enum(["PRESENT", "TARDY", "ABSENT", "EXCUSED"]);

const attendanceMarkSchema = z.object({
  childIds: z.array(z.string().uuid()).min(1),
  date: z.string().date(),
  status: attendanceStatusSchema,
  notes: z.string().max(300).optional()
});

const attendanceBulkSchema = z.object({
  date: z.string().date(),
  entries: z
    .array(
      z.object({
        childId: z.string().uuid(),
        status: attendanceStatusSchema,
        notes: z.string().max(300).optional()
      })
    )
    .min(1)
});

const gradeEntrySchema = z.object({
  childId: z.string().uuid(),
  category: z.string().min(1).max(80),
  weight: z.number().positive().max(100),
  score: z.number().min(0).max(100),
  isPublished: z.boolean().default(false)
});

const gradeBulkEntrySchema = z.object({
  entries: z
    .array(
      z.object({
        childId: z.string().uuid(),
        category: z.string().min(1).max(80),
        weight: z.number().positive().max(100),
        score: z.number().min(0).max(100),
        isPublished: z.boolean().default(true)
      })
    )
    .min(1)
});

const classCreateSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(1000).optional(),
  schedule: z.record(z.any()).optional()
});

const classEnrollSchema = z.object({
  childIds: z.array(z.string().uuid()).min(1).max(100)
});

const assignmentCreateSchema = z.object({
  title: z.string().min(2).max(150),
  description: z.string().max(3000).optional(),
  dueAt: z.string().datetime().optional(),
  isPublished: z.boolean().default(false)
});

const assignmentPublishSchema = z.object({
  isPublished: z.boolean()
});

const assignmentSubmitSchema = z.object({
  childId: z.string().uuid(),
  content: z.string().min(1).max(8000)
});

const staffRoleValues = [...adminRoleValues, "MENTOR"] as const;

function isStaffRole(role: string) {
  return (staffRoleValues as readonly string[]).includes(role);
}

async function getUserFamilyIds(userId: string) {
  const memberships = await prisma.familyMember.findMany({
    where: {
      userId,
      deletedAt: null,
      family: { deletedAt: null }
    },
    select: { familyId: true }
  });

  return memberships.map((item) => item.familyId);
}

async function assertFamilyCanAccessChild(userId: string, childId: string) {
  const familyIds = await getUserFamilyIds(userId);
  if (!familyIds.length) {
    return false;
  }

  const child = await prisma.child.findFirst({
    where: {
      id: childId,
      familyId: { in: familyIds },
      deletedAt: null
    },
    select: { id: true }
  });

  return Boolean(child);
}

async function resolveMentorProfileId(userId: string) {
  const mentor = await prisma.mentor.findFirst({
    where: {
      userId,
      deletedAt: null
    },
    select: { id: true }
  });

  return mentor?.id ?? null;
}

export const academicsRouter = Router();

academicsRouter.get("/classes", requireAuth, async (req, res) => {
  const role = req.auth!.role;

  if (familyRoleValues.includes(role as (typeof familyRoleValues)[number])) {
    const familyIds = await getUserFamilyIds(req.auth!.userId);
    if (!familyIds.length) {
      res.json({ classes: [] });
      return;
    }

    const classes = await prisma.class.findMany({
      where: {
        deletedAt: null,
        enrollments: {
          some: {
            deletedAt: null,
            child: {
              familyId: { in: familyIds },
              deletedAt: null
            }
          }
        }
      },
      include: {
        mentor: { include: { user: true } },
        _count: { select: { enrollments: true, assignments: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json({
      classes: classes.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        mentorName: item.mentor ? `${item.mentor.user.firstName} ${item.mentor.user.lastName}` : "Unassigned",
        enrollmentCount: item._count.enrollments,
        assignmentCount: item._count.assignments
      }))
    });
    return;
  }

  if (role === "MENTOR") {
    const mentorId = await resolveMentorProfileId(req.auth!.userId);
    if (!mentorId) {
      res.json({ classes: [] });
      return;
    }

    const classes = await prisma.class.findMany({
      where: {
        deletedAt: null,
        mentorId
      },
      include: {
        mentor: { include: { user: true } },
        _count: { select: { enrollments: true, assignments: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json({
      classes: classes.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        mentorName: item.mentor ? `${item.mentor.user.firstName} ${item.mentor.user.lastName}` : "Unassigned",
        enrollmentCount: item._count.enrollments,
        assignmentCount: item._count.assignments
      }))
    });
    return;
  }

  const classes = await prisma.class.findMany({
    where: { deletedAt: null },
    include: {
      mentor: { include: { user: true } },
      _count: { select: { enrollments: true, assignments: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  res.json({
    classes: classes.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      mentorName: item.mentor ? `${item.mentor.user.firstName} ${item.mentor.user.lastName}` : "Unassigned",
      enrollmentCount: item._count.enrollments,
      assignmentCount: item._count.assignments
    }))
  });
});

academicsRouter.post(
  "/classes",
  requireAuth,
  requireRole(["MENTOR", ...adminRoleValues]),
  validateBody(classCreateSchema),
  async (req, res) => {
    const payload = req.body;
    const mentorId = req.auth!.role === "MENTOR" ? await resolveMentorProfileId(req.auth!.userId) : null;

    const created = await prisma.class.create({
      data: {
        name: payload.name,
        description: payload.description,
        schedule: payload.schedule,
        mentorId: mentorId ?? undefined
      }
    });

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "CLASS_CREATED",
      entity: "Class",
      entityId: created.id,
      after: { name: created.name, mentorId: created.mentorId },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.status(201).json(created);
  }
);

academicsRouter.post(
  "/classes/:classId/enroll",
  requireAuth,
  requireRole(["MENTOR", ...adminRoleValues]),
  validateBody(classEnrollSchema),
  async (req, res) => {
    const classId = req.params.classId;
    const classRecord = await prisma.class.findUnique({ where: { id: classId } });
    if (!classRecord || classRecord.deletedAt) {
      res.status(404).json({ code: "NOT_FOUND", message: "Class not found." });
      return;
    }

    const mentorId = req.auth!.role === "MENTOR" ? await resolveMentorProfileId(req.auth!.userId) : null;
    if (req.auth!.role === "MENTOR" && classRecord.mentorId !== mentorId) {
      res.status(403).json({ code: "FORBIDDEN", message: "Mentor can only enroll students in assigned classes." });
      return;
    }

    const childIds = req.body.childIds as string[];

    const result = await prisma.$transaction(
      childIds.map((childId) =>
        prisma.enrollment.upsert({
          where: { classId_childId: { classId, childId } },
          create: { classId, childId, isActive: true },
          update: { isActive: true, deletedAt: null }
        })
      )
    );

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "CLASS_ENROLLMENTS_UPDATED",
      entity: "Class",
      entityId: classId,
      after: { count: result.length },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json({ classId, enrolled: result.length });
  }
);

academicsRouter.get("/classes/:classId/roster", requireAuth, async (req, res) => {
  const classId = req.params.classId;
  const classRecord = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      enrollments: {
        where: { deletedAt: null, isActive: true },
        include: { child: true }
      },
      mentor: { include: { user: true } }
    }
  });

  if (!classRecord || classRecord.deletedAt) {
    res.status(404).json({ code: "NOT_FOUND", message: "Class not found." });
    return;
  }

  const role = req.auth!.role;

  if (familyRoleValues.includes(role as (typeof familyRoleValues)[number])) {
    const familyIds = await getUserFamilyIds(req.auth!.userId);
    const hasFamilyChild = classRecord.enrollments.some((item) => familyIds.includes(item.child.familyId));
    if (!hasFamilyChild) {
      res.status(403).json({ code: "FORBIDDEN", message: "No access to this class roster." });
      return;
    }
  }

  if (role === "MENTOR") {
    const mentorId = await resolveMentorProfileId(req.auth!.userId);
    if (classRecord.mentorId !== mentorId) {
      res.status(403).json({ code: "FORBIDDEN", message: "Mentor can only view assigned class roster." });
      return;
    }
  }

  res.json({
    classId,
    className: classRecord.name,
    mentorName: classRecord.mentor ? `${classRecord.mentor.user.firstName} ${classRecord.mentor.user.lastName}` : null,
    roster: classRecord.enrollments.map((enrollment) => ({
      childId: enrollment.childId,
      childName: `${enrollment.child.firstName} ${enrollment.child.lastName}`,
      gradeLevel: enrollment.child.gradeLevel
    }))
  });
});

academicsRouter.get("/classes/:classId/assignments", requireAuth, async (req, res) => {
  const classId = req.params.classId;
  const classRecord = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      enrollments: {
        where: { deletedAt: null, isActive: true },
        include: { child: true }
      }
    }
  });

  if (!classRecord || classRecord.deletedAt) {
    res.status(404).json({ code: "NOT_FOUND", message: "Class not found." });
    return;
  }

  const role = req.auth!.role;
  if (familyRoleValues.includes(role as (typeof familyRoleValues)[number])) {
    const familyIds = await getUserFamilyIds(req.auth!.userId);
    const hasFamilyChild = classRecord.enrollments.some((item) => familyIds.includes(item.child.familyId));
    if (!hasFamilyChild) {
      res.status(403).json({ code: "FORBIDDEN", message: "No access to this class assignments." });
      return;
    }
  }

  const assignments = await prisma.assignment.findMany({
    where: {
      classId,
      deletedAt: null
    },
    include: {
      submissions: {
        where: { deletedAt: null },
        include: { child: true }
      }
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }]
  });

  res.json({
    classId,
    assignments: assignments.map((assignment) => ({
      id: assignment.id,
      title: assignment.title,
      description: assignment.description,
      dueAt: assignment.dueAt,
      isPublished: assignment.isPublished,
      submissionCount: assignment.submissions.length,
      submissions: assignment.submissions.map((submission) => ({
        id: submission.id,
        childId: submission.childId,
        childName: `${submission.child.firstName} ${submission.child.lastName}`,
        content: submission.content,
        score: submission.score,
        submittedAt: submission.submittedAt
      }))
    }))
  });
});

academicsRouter.post(
  "/classes/:classId/assignments",
  requireAuth,
  requireRole(["MENTOR", ...adminRoleValues]),
  validateBody(assignmentCreateSchema),
  async (req, res) => {
    const classId = req.params.classId;
    const classRecord = await prisma.class.findUnique({ where: { id: classId } });
    if (!classRecord || classRecord.deletedAt) {
      res.status(404).json({ code: "NOT_FOUND", message: "Class not found." });
      return;
    }

    if (req.auth!.role === "MENTOR") {
      const mentorId = await resolveMentorProfileId(req.auth!.userId);
      if (classRecord.mentorId !== mentorId) {
        res.status(403).json({ code: "FORBIDDEN", message: "Mentor can only manage assigned classes." });
        return;
      }
    }

    const payload = req.body;
    const assignment = await prisma.assignment.create({
      data: {
        classId,
        title: payload.title,
        description: payload.description,
        dueAt: payload.dueAt ? new Date(payload.dueAt) : undefined,
        isPublished: payload.isPublished
      }
    });

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "ASSIGNMENT_CREATED",
      entity: "Assignment",
      entityId: assignment.id,
      after: {
        classId: assignment.classId,
        title: assignment.title,
        isPublished: assignment.isPublished
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.status(201).json(assignment);
  }
);

academicsRouter.patch(
  "/assignments/:id/publish",
  requireAuth,
  requireRole(["MENTOR", ...adminRoleValues]),
  validateBody(assignmentPublishSchema),
  async (req, res) => {
    const assignment = await prisma.assignment.findUnique({
      where: { id: req.params.id },
      include: { class: true }
    });

    if (!assignment || assignment.deletedAt) {
      res.status(404).json({ code: "NOT_FOUND", message: "Assignment not found." });
      return;
    }

    if (req.auth!.role === "MENTOR") {
      const mentorId = await resolveMentorProfileId(req.auth!.userId);
      if (assignment.class.mentorId !== mentorId) {
        res.status(403).json({ code: "FORBIDDEN", message: "Mentor can only manage assignments in assigned classes." });
        return;
      }
    }

    const updated = await prisma.assignment.update({
      where: { id: assignment.id },
      data: { isPublished: req.body.isPublished }
    });

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "ASSIGNMENT_PUBLISH_UPDATED",
      entity: "Assignment",
      entityId: updated.id,
      before: { isPublished: assignment.isPublished },
      after: { isPublished: updated.isPublished },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json(updated);
  }
);

academicsRouter.get("/children/:id/assignments", requireAuth, async (req, res) => {
  const childId = req.params.id;
  const role = req.auth!.role;

  if (familyRoleValues.includes(role as (typeof familyRoleValues)[number])) {
    const canAccess = await assertFamilyCanAccessChild(req.auth!.userId, childId);
    if (!canAccess) {
      res.status(403).json({ code: "FORBIDDEN", message: "No access to this child." });
      return;
    }
  }

  const enrollments = await prisma.enrollment.findMany({
    where: {
      childId,
      isActive: true,
      deletedAt: null,
      class: { deletedAt: null }
    },
    include: {
      class: {
        include: {
          assignments: {
            where: {
              deletedAt: null,
              ...(isStaffRole(role) ? {} : { isPublished: true })
            },
            include: {
              submissions: {
                where: { childId, deletedAt: null }
              }
            },
            orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }]
          }
        }
      }
    }
  });

  const assignments = enrollments.flatMap((enrollment) =>
    enrollment.class.assignments.map((assignment) => ({
      assignmentId: assignment.id,
      classId: enrollment.classId,
      className: enrollment.class.name,
      title: assignment.title,
      description: assignment.description,
      dueAt: assignment.dueAt,
      isPublished: assignment.isPublished,
      submission: assignment.submissions[0]
        ? {
            id: assignment.submissions[0].id,
            content: assignment.submissions[0].content,
            score: assignment.submissions[0].score,
            submittedAt: assignment.submissions[0].submittedAt
          }
        : null
    }))
  );

  res.json({ childId, assignments });
});

academicsRouter.post(
  "/assignments/:id/submissions",
  requireAuth,
  requireRole(["CHILD", ...familyRoleValues, "MENTOR", ...adminRoleValues]),
  validateBody(assignmentSubmitSchema),
  async (req, res) => {
    const assignment = await prisma.assignment.findUnique({
      where: { id: req.params.id },
      include: { class: true }
    });
    if (!assignment || assignment.deletedAt) {
      res.status(404).json({ code: "NOT_FOUND", message: "Assignment not found." });
      return;
    }

    const payload = req.body;
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        classId: assignment.classId,
        childId: payload.childId,
        isActive: true,
        deletedAt: null
      }
    });

    if (!enrollment) {
      res.status(400).json({ code: "NOT_ENROLLED", message: "Child is not enrolled in this class." });
      return;
    }

    const role = req.auth!.role;
    if (familyRoleValues.includes(role as (typeof familyRoleValues)[number])) {
      const canAccess = await assertFamilyCanAccessChild(req.auth!.userId, payload.childId);
      if (!canAccess) {
        res.status(403).json({ code: "FORBIDDEN", message: "No access to this child submission." });
        return;
      }
    }

    const submission = await prisma.assignmentSubmission.upsert({
      where: {
        assignmentId_childId: {
          assignmentId: assignment.id,
          childId: payload.childId
        }
      },
      create: {
        assignmentId: assignment.id,
        childId: payload.childId,
        content: payload.content
      },
      update: {
        content: payload.content,
        submittedAt: new Date(),
        deletedAt: null
      }
    });

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "ASSIGNMENT_SUBMITTED",
      entity: "AssignmentSubmission",
      entityId: submission.id,
      after: {
        assignmentId: submission.assignmentId,
        childId: submission.childId
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.status(201).json(submission);
  }
);

academicsRouter.get("/attendance", requireAuth, async (req, res) => {
  const date = typeof req.query.date === "string" ? req.query.date : new Date().toISOString().slice(0, 10);
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(`${date}T23:59:59.999Z`);

  const records = await prisma.attendanceRecord.findMany({
    where: {
      date: { gte: start, lte: end },
      deletedAt: null
    },
    include: {
      child: true
    },
    orderBy: { createdAt: "desc" }
  });

  res.json({
    date,
    records: records.map((record) => ({
      id: record.id,
      childId: record.childId,
      childName: `${record.child.firstName} ${record.child.lastName}`,
      status: record.status,
      minutesPresent: record.minutesPresent,
      notes: record.notes
    }))
  });
});

academicsRouter.post(
  "/attendance/mark",
  requireAuth,
  requireRole(["MENTOR", ...adminRoleValues]),
  validateBody(attendanceMarkSchema),
  async (req, res) => {
    const payload = req.body;
    const date = new Date(`${payload.date}T00:00:00.000Z`);

    const records = await prisma.$transaction(
      payload.childIds.map((childId) =>
        prisma.attendanceRecord.upsert({
          where: {
            id: `${childId}_${payload.date}`
          },
          create: {
            id: `${childId}_${payload.date}`,
            childId,
            date,
            status: payload.status,
            notes: payload.notes,
            markedById: req.auth?.userId,
            minutesPresent: payload.status === "PRESENT" ? 60 : payload.status === "TARDY" ? 40 : 0
          },
          update: {
            status: payload.status,
            notes: payload.notes,
            markedById: req.auth?.userId,
            minutesPresent: payload.status === "PRESENT" ? 60 : payload.status === "TARDY" ? 40 : 0
          }
        })
      )
    );

    await Promise.all(
      records.map((record) =>
        prisma.attendanceAudit.create({
          data: {
            attendanceId: record.id,
            actorUserId: req.auth!.userId,
            before: undefined,
            after: { status: record.status, notes: record.notes }
          }
        })
      )
    );

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "ATTENDANCE_MARKED",
      entity: "AttendanceRecord",
      entityId: `${records.length}_records`,
      after: {
        date: payload.date,
        status: payload.status,
        count: records.length
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json({ count: records.length, status: payload.status });
  }
);

academicsRouter.post(
  "/attendance/mark-bulk",
  requireAuth,
  requireRole(["MENTOR", ...adminRoleValues]),
  validateBody(attendanceBulkSchema),
  async (req, res) => {
    const payload = req.body;
    const date = new Date(`${payload.date}T00:00:00.000Z`);
    const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);

    let created = 0;
    let updated = 0;

    await prisma.$transaction(
      payload.entries.map(async (entry) => {
        const existing = await prisma.attendanceRecord.findFirst({
          where: {
            childId: entry.childId,
            date: { gte: date, lt: nextDate },
            deletedAt: null
          }
        });

        const minutesPresent = entry.status === "PRESENT" ? 60 : entry.status === "TARDY" ? 40 : 0;

        if (existing) {
          const record = await prisma.attendanceRecord.update({
            where: { id: existing.id },
            data: {
              status: entry.status,
              notes: entry.notes,
              markedById: req.auth?.userId,
              minutesPresent
            }
          });

          await prisma.attendanceAudit.create({
            data: {
              attendanceId: record.id,
              actorUserId: req.auth!.userId,
              before: { status: existing.status, notes: existing.notes },
              after: { status: record.status, notes: record.notes }
            }
          });
          updated += 1;
          return;
        }

        const record = await prisma.attendanceRecord.create({
          data: {
            childId: entry.childId,
            date,
            status: entry.status,
            notes: entry.notes,
            markedById: req.auth?.userId,
            minutesPresent
          }
        });

        await prisma.attendanceAudit.create({
          data: {
            attendanceId: record.id,
            actorUserId: req.auth!.userId,
            after: { status: record.status, notes: record.notes }
          }
        });
        created += 1;
      })
    );

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "ATTENDANCE_BULK_MARKED",
      entity: "AttendanceRecord",
      entityId: payload.date,
      after: { created, updated, count: payload.entries.length },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json({ created, updated, count: payload.entries.length, date: payload.date });
  }
);

academicsRouter.get("/children/:id/attendance", requireAuth, async (req, res) => {
  const childId = req.params.id;
  const role = req.auth!.role;

  if (familyRoleValues.includes(role as (typeof familyRoleValues)[number])) {
    const canAccess = await assertFamilyCanAccessChild(req.auth!.userId, childId);
    if (!canAccess) {
      res.status(403).json({ code: "FORBIDDEN", message: "No access to this child attendance." });
      return;
    }
  }

  const records = await prisma.attendanceRecord.findMany({
    where: {
      childId,
      deletedAt: null
    },
    orderBy: { date: "desc" }
  });

  const total = records.length;
  const presentLike = records.filter((item) => item.status === "PRESENT" || item.status === "TARDY").length;
  const attendancePercent = total === 0 ? 0 : Math.round((presentLike / total) * 100);

  res.json({
    childId,
    attendancePercent,
    records
  });
});

academicsRouter.get("/gradebook/:classId", requireAuth, async (req, res) => {
  const classId = req.params.classId;
  const role = req.auth!.role;
  let familyChildIds: string[] | null = null;

  if (familyRoleValues.includes(role as (typeof familyRoleValues)[number])) {
    const familyIds = await getUserFamilyIds(req.auth!.userId);
    const children = await prisma.child.findMany({
      where: {
        familyId: { in: familyIds },
        deletedAt: null
      },
      select: { id: true }
    });
    familyChildIds = children.map((child) => child.id);
  }

  const grades = await prisma.grade.findMany({
    where: {
      classId,
      deletedAt: null,
      ...(familyChildIds ? { childId: { in: familyChildIds } } : {})
    },
    include: {
      child: true
    },
    orderBy: { createdAt: "desc" }
  });

  res.json({
    classId,
    entries: grades.map((grade) => ({
      id: grade.id,
      childId: grade.childId,
      childName: `${grade.child.firstName} ${grade.child.lastName}`,
      category: grade.category,
      weight: grade.weight,
      score: grade.score,
      isPublished: grade.isPublished
    }))
  });
});

academicsRouter.get("/gradebook/:classId/summary", requireAuth, async (req, res) => {
  const classId = req.params.classId;
  const role = req.auth!.role;
  let familyChildIds: string[] | null = null;

  if (familyRoleValues.includes(role as (typeof familyRoleValues)[number])) {
    const familyIds = await getUserFamilyIds(req.auth!.userId);
    const children = await prisma.child.findMany({
      where: {
        familyId: { in: familyIds },
        deletedAt: null
      },
      select: { id: true }
    });
    familyChildIds = children.map((child) => child.id);
  }

  const grades = await prisma.grade.findMany({
    where: {
      classId,
      deletedAt: null,
      ...(familyChildIds ? { childId: { in: familyChildIds } } : {})
    },
    include: { child: true },
    orderBy: [{ childId: "asc" }, { createdAt: "asc" }]
  });

  const grouped = new Map<
    string,
    {
      childId: string;
      childName: string;
      totalWeight: number;
      weightedScore: number;
      entries: number;
      categories: Record<string, { weighted: number; weight: number }>;
    }
  >();

  for (const grade of grades) {
    const current = grouped.get(grade.childId) ?? {
      childId: grade.childId,
      childName: `${grade.child.firstName} ${grade.child.lastName}`,
      totalWeight: 0,
      weightedScore: 0,
      entries: 0,
      categories: {}
    };

    current.totalWeight += grade.weight;
    current.weightedScore += grade.score * grade.weight;
    current.entries += 1;

    if (!current.categories[grade.category]) {
      current.categories[grade.category] = { weighted: 0, weight: 0 };
    }
    current.categories[grade.category].weighted += grade.score * grade.weight;
    current.categories[grade.category].weight += grade.weight;

    grouped.set(grade.childId, current);
  }

  res.json({
    classId,
    students: Array.from(grouped.values()).map((item) => ({
      childId: item.childId,
      childName: item.childName,
      entries: item.entries,
      weightedAverage: item.totalWeight > 0 ? Number((item.weightedScore / item.totalWeight).toFixed(2)) : null,
      categories: Object.entries(item.categories).map(([category, categoryScore]) => ({
        category,
        average: categoryScore.weight > 0 ? Number((categoryScore.weighted / categoryScore.weight).toFixed(2)) : null
      }))
    }))
  });
});

academicsRouter.post(
  "/gradebook/:classId/entry",
  requireAuth,
  requireRole(["MENTOR", ...adminRoleValues]),
  validateBody(gradeEntrySchema),
  async (req, res) => {
    const payload = req.body;

    const grade = await prisma.grade.create({
      data: {
        classId: req.params.classId,
        childId: payload.childId,
        category: payload.category,
        weight: payload.weight,
        score: payload.score,
        isPublished: payload.isPublished
      }
    });

    await prisma.gradeHistory.create({
      data: {
        gradeId: grade.id,
        actorUserId: req.auth!.userId,
        before: undefined,
        after: {
          category: grade.category,
          score: grade.score,
          weight: grade.weight,
          isPublished: grade.isPublished
        }
      }
    });

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "GRADE_CREATED",
      entity: "Grade",
      entityId: grade.id,
      after: {
        classId: grade.classId,
        childId: grade.childId,
        score: grade.score
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.status(201).json(grade);
  }
);

academicsRouter.post(
  "/gradebook/:classId/bulk-entry",
  requireAuth,
  requireRole(["MENTOR", ...adminRoleValues]),
  validateBody(gradeBulkEntrySchema),
  async (req, res) => {
    const classId = req.params.classId;
    const payload = req.body;

    const grades = await prisma.$transaction(
      payload.entries.map((entry) =>
        prisma.grade.create({
          data: {
            classId,
            childId: entry.childId,
            category: entry.category,
            weight: entry.weight,
            score: entry.score,
            isPublished: entry.isPublished
          }
        })
      )
    );

    await prisma.$transaction(
      grades.map((grade) =>
        prisma.gradeHistory.create({
          data: {
            gradeId: grade.id,
            actorUserId: req.auth!.userId,
            after: {
              category: grade.category,
              score: grade.score,
              weight: grade.weight,
              isPublished: grade.isPublished
            }
          }
        })
      )
    );

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "GRADE_BULK_CREATED",
      entity: "Grade",
      entityId: classId,
      after: {
        count: grades.length,
        classId
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.status(201).json({
      classId,
      count: grades.length
    });
  }
);
