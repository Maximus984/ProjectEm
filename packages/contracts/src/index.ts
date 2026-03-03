import { z } from "zod";

export const adminRoleValues = ["OWNER", "MANAGER", "MEDIUM", "MONITOR", "ADMIN"] as const;
export const writableAdminRoleValues = ["OWNER", "MANAGER", "MEDIUM", "ADMIN"] as const;
export const destructiveAdminRoleValues = ["OWNER", "MANAGER", "ADMIN"] as const;
export const familyRoleValues = ["FAMILY", "PARENT"] as const;
export const staffRoleValues = ["OWNER", "MANAGER", "MEDIUM", "MONITOR", "ADMIN", "MENTOR"] as const;

export const userRoleSchema = z.enum([
  "OWNER",
  "MANAGER",
  "MEDIUM",
  "MONITOR",
  "ADMIN",
  "MENTOR",
  "CLIENT",
  "FAMILY",
  "PARENT",
  "CHILD"
]);
export type UserRole = z.infer<typeof userRoleSchema>;
export type AdminRole = (typeof adminRoleValues)[number];

export function isAdminRole(role: UserRole): role is AdminRole {
  return (adminRoleValues as readonly string[]).includes(role);
}

export function isFamilyRole(role: UserRole): boolean {
  return (familyRoleValues as readonly string[]).includes(role);
}

export function isStaffRole(role: UserRole): boolean {
  return (staffRoleValues as readonly string[]).includes(role);
}

export function canWriteAdmin(role: UserRole): boolean {
  return (writableAdminRoleValues as readonly string[]).includes(role);
}

export function canDeleteAdmin(role: UserRole): boolean {
  return (destructiveAdminRoleValues as readonly string[]).includes(role);
}

export const bookingTierSchema = z.enum([
  "PREMIUM_GENIUS",
  "BYOD_MENTORSHIP",
  "STANDARD_CARE"
]);
export type BookingTier = z.infer<typeof bookingTierSchema>;

export const bookingStatusSchema = z.enum([
  "SUBMITTED",
  "ZOOM_INTERVIEW",
  "CONFIRMED",
  "SESSION_IN_PROGRESS",
  "CHECKED_IN",
  "PAID",
  "COMPLETED",
  "CANCELED"
]);
export type BookingStatus = z.infer<typeof bookingStatusSchema>;

export const sessionLiveStatusSchema = z.enum([
  "EN_ROUTE",
  "ARRIVED",
  "IN_SESSION",
  "COMPLETED"
]);
export type SessionLiveStatus = z.infer<typeof sessionLiveStatusSchema>;

export const registerChildSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  dob: z.string().date().optional(),
  gradeLevel: z.string().max(30).optional()
});

export const registerCoParentSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(10).max(128),
  phone: z.string().min(7).max(30),
  billingRole: z.enum(["PRIMARY", "SECONDARY"]).default("SECONDARY")
});

export const authRegisterSchema = z
  .object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(10).max(128),
  phone: z.string().min(7).max(30),
  children: z.array(registerChildSchema).max(5).optional(),
  coParent: registerCoParentSchema.optional(),
  // Legacy compatibility
  createChildNow: z.boolean().default(true),
  child: registerChildSchema.optional()
})
  .superRefine((value, ctx) => {
    const childCount = value.children?.length ?? 0;
    if (childCount === 0 && !value.child) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one child profile is required for family onboarding.",
        path: ["children"]
      });
    }
  });
export type AuthRegisterInput = z.infer<typeof authRegisterSchema>;

export const authLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totpCode: z.string().min(6).max(8).optional()
});
export type AuthLoginInput = z.infer<typeof authLoginSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(20)
});
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

export const availabilityQuerySchema = z.object({
  date: z.string().date(),
  tier: bookingTierSchema,
  timezone: z.string().min(3).max(64)
});
export type AvailabilityQueryInput = z.infer<typeof availabilityQuerySchema>;

export const bookingCreateSchema = z.object({
  familyId: z.string().uuid(),
  childId: z.string().uuid(),
  tier: bookingTierSchema,
  timezone: z.string().min(3).max(64),
  date: z.string().date(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  mode: z.enum(["IN_PERSON", "VIRTUAL"]),
  notes: z.string().max(2000).optional(),
  requiresHardware: z.boolean().default(false),
  parentOptOutZoomIntro: z.boolean().default(false),
  couponCode: z.string().max(30).optional()
});
export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;

export const bookingStatusUpdateSchema = z.object({
  bookingId: z.string().uuid(),
  status: bookingStatusSchema,
  reason: z.string().max(500).optional()
});
export type BookingStatusUpdateInput = z.infer<typeof bookingStatusUpdateSchema>;

export const checkinQrSchema = z.object({
  qrToken: z.string().min(16)
});
export type CheckinQrInput = z.infer<typeof checkinQrSchema>;

export const checkinCodeSchema = z.object({
  bookingId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/)
});
export type CheckinCodeInput = z.infer<typeof checkinCodeSchema>;

export const supportTicketSchema = z.object({
  subject: z.string().min(3).max(120),
  category: z.enum(["ACCOUNT", "BOOKING", "BILLING", "TECHNICAL", "OTHER"]),
  message: z.string().min(10).max(3000),
  contactEmail: z.string().email()
});
export type SupportTicketInput = z.infer<typeof supportTicketSchema>;

export const mentorApplicationSchema = z.object({
  fullName: z.string().min(3).max(120),
  email: z.string().email(),
  phone: z.string().min(7).max(30),
  resumeUrl: z.string().url(),
  hasBackgroundConsent: z.literal(true),
  availabilitySummary: z.string().min(10).max(1000),
  preferredTopics: z.array(z.enum(["TECH", "BUSINESS", "LEGAL", "ACADEMIC"]))
});
export type MentorApplicationInput = z.infer<typeof mentorApplicationSchema>;

export const childPageSaveSchema = z.object({
  childId: z.string().uuid(),
  title: z.string().min(1).max(120),
  themeKey: z.string().min(1).max(50),
  publicVisible: z.boolean(),
  sections: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["TEXT", "GALLERY", "VIDEO", "CODE", "DOWNLOADS"]),
      order: z.number().int().nonnegative(),
      data: z.record(z.any())
    })
  )
});
export type ChildPageSaveInput = z.infer<typeof childPageSaveSchema>;

export const apiErrorSchema = z.object({
  message: z.string(),
  code: z.string(),
  requestId: z.string().optional(),
  issues: z.array(z.string()).optional()
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresInSeconds: z.number().int().positive()
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

export const supportContacts = {
  phone: "(415) 483-0648",
  instagramHandle: "maxxforgestudio",
  instagramUrl: "https://www.instagram.com/maxxforgestudio/",
  discordUrl: "https://discord.gg/mcny3pxmKS"
} as const;

export const projectTiers = {
  PREMIUM_GENIUS: {
    label: "Premium Genius",
    pricePerHour: 45
  },
  BYOD_MENTORSHIP: {
    label: "BYOD Mentorship",
    pricePerHour: 40
  },
  STANDARD_CARE: {
    label: "Standard Care",
    pricePerHour: 32
  }
} as const;

export const diagnosticQuestionTypeSchema = z.enum(["mcq", "short_answer", "problem"]);
export type DiagnosticQuestionType = z.infer<typeof diagnosticQuestionTypeSchema>;

export const diagnosticToolSchema = z.enum([
  "calculator",
  "ruler",
  "protractor",
  "scratchpad",
  "formula_sheet",
  "graph_grid"
]);
export type DiagnosticTool = z.infer<typeof diagnosticToolSchema>;

export const diagnosticConfidenceSchema = z.enum(["very_confident", "somewhat_confident", "guessing"]);
export type DiagnosticConfidence = z.infer<typeof diagnosticConfidenceSchema>;

export const diagnosticQuestionSchema = z.object({
  question_id: z.string().min(2).max(40),
  grade: z.number().int().min(7).max(12),
  index: z.number().int().min(1).max(30),
  difficulty: z.number().int().min(1).max(10),
  subject: z.enum(["Technology", "Coding", "Law", "Business", "Math", "Reading", "History"]),
  type: diagnosticQuestionTypeSchema,
  stem: z.string().min(2).max(3000),
  choices: z.array(z.string().min(1).max(300)).optional(),
  expected_time_seconds: z.number().int().min(10).max(600),
  required_tools: z.array(diagnosticToolSchema).max(6).optional(),
  metadata_tags: z.array(z.string().min(1).max(40)).max(12).optional()
});
export type DiagnosticQuestion = z.infer<typeof diagnosticQuestionSchema>;

export const diagnosticRuntimeActionSchema = z.enum([
  "get_questions",
  "record_event",
  "submit_attempt",
  "get_answers",
  "reassign_attempt"
]);
export type DiagnosticRuntimeAction = z.infer<typeof diagnosticRuntimeActionSchema>;

export const diagnosticAttemptStartEventSchema = z.object({
  event_type: z.literal("attempt_start"),
  attempt_id: z.string().min(6).max(120),
  student_id: z.string().min(2).max(120),
  grade: z.number().int().min(7).max(12),
  test_id: z.string().min(2).max(120),
  start_time: z.string().datetime(),
  userAgent: z.string().max(1000).optional()
});

export const diagnosticQuestionShownEventSchema = z.object({
  event_type: z.literal("question_shown"),
  attempt_id: z.string().min(6).max(120),
  question_id: z.string().min(2).max(40),
  shown_time: z.string().datetime()
});

export const diagnosticFirstInteractionEventSchema = z.object({
  event_type: z.literal("first_interaction"),
  attempt_id: z.string().min(6).max(120),
  question_id: z.string().min(2).max(40),
  time: z.string().datetime()
});

export const diagnosticAnswerSaveEventSchema = z.object({
  event_type: z.literal("answer_save"),
  attempt_id: z.string().min(6).max(120),
  question_id: z.string().min(2).max(40),
  answer: z.union([z.string(), z.number(), z.array(z.string()), z.null()]),
  time: z.string().datetime(),
  is_final: z.boolean(),
  paste_event: z.boolean().default(false),
  confidence: diagnosticConfidenceSchema.optional()
});

export const diagnosticBreakStartEventSchema = z.object({
  event_type: z.literal("break_start"),
  attempt_id: z.string().min(6).max(120),
  start_time: z.string().datetime()
});

export const diagnosticBreakEndEventSchema = z.object({
  event_type: z.literal("break_end"),
  attempt_id: z.string().min(6).max(120),
  end_time: z.string().datetime()
});

export const diagnosticFocusChangeEventSchema = z.object({
  event_type: z.literal("focus_change"),
  attempt_id: z.string().min(6).max(120),
  event: z.enum(["hidden", "visible"]),
  time: z.string().datetime()
});

export const diagnosticToolUsageEventSchema = z.object({
  event_type: z.literal("tool_usage"),
  attempt_id: z.string().min(6).max(120),
  question_id: z.string().min(2).max(40).optional(),
  tool: diagnosticToolSchema,
  action: z.enum(["open", "close", "used"]),
  duration_seconds: z.number().int().min(0).max(7200).optional(),
  time: z.string().datetime()
});

export const diagnosticAttemptSubmitEventSchema = z.object({
  event_type: z.literal("attempt_submit"),
  attempt_id: z.string().min(6).max(120),
  end_time: z.string().datetime()
});

export const diagnosticTelemetryEventSchema = z.discriminatedUnion("event_type", [
  diagnosticAttemptStartEventSchema,
  diagnosticQuestionShownEventSchema,
  diagnosticFirstInteractionEventSchema,
  diagnosticAnswerSaveEventSchema,
  diagnosticBreakStartEventSchema,
  diagnosticBreakEndEventSchema,
  diagnosticFocusChangeEventSchema,
  diagnosticToolUsageEventSchema,
  diagnosticAttemptSubmitEventSchema
]);
export type DiagnosticTelemetryEvent = z.infer<typeof diagnosticTelemetryEventSchema>;

export const roleBadgePalette: Record<
  UserRole,
  { label: string; color: string; background: string; border: string }
> = {
  OWNER: { label: "Owner", color: "#111827", background: "#fbbf24", border: "#f59e0b" },
  MANAGER: { label: "Manager", color: "#e5f9f5", background: "#0f766e", border: "#14b8a6" },
  MEDIUM: { label: "Medium", color: "#eef2ff", background: "#3730a3", border: "#6366f1" },
  MONITOR: { label: "Monitor", color: "#e0f2fe", background: "#0369a1", border: "#0ea5e9" },
  ADMIN: { label: "Admin", color: "#fee2e2", background: "#7f1d1d", border: "#dc2626" },
  MENTOR: { label: "Mentor", color: "#ecfeff", background: "#155e75", border: "#06b6d4" },
  CLIENT: { label: "Client", color: "#ffe4e6", background: "#9f1239", border: "#f43f5e" },
  FAMILY: { label: "Family", color: "#ede9fe", background: "#5b21b6", border: "#8b5cf6" },
  PARENT: { label: "Parent", color: "#ede9fe", background: "#6d28d9", border: "#a78bfa" },
  CHILD: { label: "Child", color: "#ecfccb", background: "#3f6212", border: "#84cc16" }
};
