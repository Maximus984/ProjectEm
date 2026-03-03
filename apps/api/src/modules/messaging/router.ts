import { isAdminRole } from "@projectm/contracts";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { writeAuditLog } from "../../utils/audit.js";

const conversationSchema = z.object({
  type: z.enum(["PARENT_MENTOR", "PARENT_ADMIN", "CHILD_MENTOR", "SUPPORT"]),
  familyId: z.string().uuid().optional(),
  childId: z.string().uuid().optional(),
  mentorId: z.string().uuid().optional()
});

const messageSchema = z.object({
  body: z.string().min(1).max(4000),
  attachments: z.array(z.string().url()).default([])
});

type AccessContext = {
  familyIds: Set<string>;
  familyChildIds: Set<string>;
  childId: string | null;
  mentorId: string | null;
  sentConversationIds: Set<string>;
};

async function buildAccessContext(userId: string): Promise<AccessContext> {
  const [memberships, childProfile, mentorProfile, sentConversationRows] = await Promise.all([
    prisma.familyMember.findMany({
      where: { userId, deletedAt: null, family: { deletedAt: null } },
      select: { familyId: true }
    }),
    prisma.child.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true }
    }),
    prisma.mentor.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true }
    }),
    prisma.message.findMany({
      where: { senderId: userId, deletedAt: null },
      select: { conversationId: true },
      distinct: ["conversationId"]
    })
  ]);

  const familyIds = new Set(memberships.map((item) => item.familyId));
  const familyChildRows =
    familyIds.size === 0
      ? []
      : await prisma.child.findMany({
          where: {
            familyId: { in: Array.from(familyIds) },
            deletedAt: null
          },
          select: { id: true }
        });

  return {
    familyIds,
    familyChildIds: new Set(familyChildRows.map((item) => item.id)),
    childId: childProfile?.id ?? null,
    mentorId: mentorProfile?.id ?? null,
    sentConversationIds: new Set(sentConversationRows.map((item) => item.conversationId))
  };
}

function canAccessConversation(params: {
  conversation: {
    id: string;
    familyId: string | null;
    childId: string | null;
    mentorId: string | null;
    createdById: string;
  };
  userId: string;
  role: string;
  accessContext: AccessContext;
}) {
  const { conversation, userId, role, accessContext } = params;

  if (isAdminRole(role as Parameters<typeof isAdminRole>[0])) {
    return true;
  }

  if (conversation.createdById === userId) {
    return true;
  }

  if (accessContext.sentConversationIds.has(conversation.id)) {
    return true;
  }

  if (conversation.familyId && accessContext.familyIds.has(conversation.familyId)) {
    return true;
  }

  if (conversation.childId && accessContext.familyChildIds.has(conversation.childId)) {
    return true;
  }

  if (conversation.childId && accessContext.childId && conversation.childId === accessContext.childId) {
    return true;
  }

  if (role === "MENTOR" && conversation.mentorId && accessContext.mentorId === conversation.mentorId) {
    return true;
  }

  return false;
}

export const messagingRouter = Router();

messagingRouter.use(requireAuth);

messagingRouter.get("/conversations", async (req, res) => {
  const userId = req.auth!.userId;
  const role = req.auth!.role;
  const accessContext = await buildAccessContext(userId);

  const allConversations = await prisma.conversation.findMany({
    where: {
      deletedAt: null
    },
    orderBy: { updatedAt: "desc" },
    take: 200
  });

  const conversations = allConversations.filter((conversation) =>
    canAccessConversation({
      conversation,
      userId,
      role,
      accessContext
    })
  );

  const enriched = await Promise.all(
    conversations.map(async (conversation) => {
      const [lastMessage, unreadCount] = await Promise.all([
        prisma.message.findFirst({
          where: {
            conversationId: conversation.id,
            deletedAt: null
          },
          include: {
            sender: {
              select: {
                firstName: true,
                lastName: true,
                role: true
              }
            }
          },
          orderBy: { createdAt: "desc" }
        }),
        prisma.message.count({
          where: {
            conversationId: conversation.id,
            deletedAt: null,
            senderId: { not: userId },
            isRead: false
          }
        })
      ]);

      return {
        id: conversation.id,
        type: conversation.type,
        familyId: conversation.familyId,
        childId: conversation.childId,
        mentorId: conversation.mentorId,
        createdById: conversation.createdById,
        updatedAt: conversation.updatedAt,
        unreadCount,
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              body: lastMessage.body,
              createdAt: lastMessage.createdAt,
              senderId: lastMessage.senderId,
              senderName: `${lastMessage.sender.firstName} ${lastMessage.sender.lastName}`,
              senderRole: lastMessage.sender.role
            }
          : null
      };
    })
  );

  res.json({ conversations: enriched });
});

messagingRouter.post("/conversations", validateBody(conversationSchema), async (req, res) => {
  const payload = req.body;
  const userId = req.auth!.userId;
  const role = req.auth!.role;
  const accessContext = await buildAccessContext(userId);

  if (!isAdminRole(role as Parameters<typeof isAdminRole>[0])) {
    const hasFamilyAccess = Boolean(payload.familyId && accessContext.familyIds.has(payload.familyId));
    const hasChildAccess = Boolean(
      payload.childId &&
        (accessContext.familyChildIds.has(payload.childId) || accessContext.childId === payload.childId)
    );
    const hasMentorAccess = Boolean(role === "MENTOR" && payload.mentorId && payload.mentorId === accessContext.mentorId);
    const supportConversationAllowed =
      payload.type === "SUPPORT" && !payload.familyId && !payload.childId && !payload.mentorId;

    if (!hasFamilyAccess && !hasChildAccess && !hasMentorAccess && !supportConversationAllowed) {
      res.status(403).json({
        code: "FORBIDDEN",
        message: "You can only create conversations within your accessible family/child scope."
      });
      return;
    }
  }

  const conversation = await prisma.conversation.create({
    data: {
      type: payload.type,
      familyId: payload.familyId,
      childId: payload.childId,
      mentorId: payload.mentorId,
      createdById: userId
    }
  });

  await writeAuditLog({
    actorUserId: req.auth?.userId,
    action: "CONVERSATION_CREATED",
    entity: "Conversation",
    entityId: conversation.id,
    after: { type: conversation.type, familyId: conversation.familyId, childId: conversation.childId },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"]
  });

  res.status(201).json(conversation);
});

messagingRouter.get("/conversations/:id/messages", async (req, res) => {
  const userId = req.auth!.userId;
  const role = req.auth!.role;
  const conversation = await prisma.conversation.findUnique({
    where: { id: req.params.id }
  });

  if (!conversation || conversation.deletedAt) {
    res.status(404).json({ code: "NOT_FOUND", message: "Conversation not found." });
    return;
  }

  const accessContext = await buildAccessContext(userId);
  const allowed = canAccessConversation({
    conversation,
    userId,
    role,
    accessContext
  });

  if (!allowed) {
    res.status(403).json({ code: "FORBIDDEN", message: "No access to this conversation." });
    return;
  }

  const messages = await prisma.message.findMany({
    where: {
      conversationId: req.params.id,
      deletedAt: null
    },
    include: {
      sender: {
        select: {
          firstName: true,
          lastName: true,
          role: true
        }
      }
    },
    orderBy: { createdAt: "asc" },
    take: 500
  });

  res.json({
    conversationId: req.params.id,
    messages: messages.map((message) => ({
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderName: `${message.sender.firstName} ${message.sender.lastName}`,
      senderRole: message.sender.role,
      body: message.body,
      attachments: message.attachments,
      isRead: message.isRead,
      readAt: message.readAt,
      flagged: message.flagged,
      createdAt: message.createdAt
    }))
  });
});

messagingRouter.post("/conversations/:id/messages", validateBody(messageSchema), async (req, res) => {
  const payload = req.body;
  const userId = req.auth!.userId;
  const role = req.auth!.role;
  const conversation = await prisma.conversation.findUnique({
    where: { id: req.params.id }
  });

  if (!conversation || conversation.deletedAt) {
    res.status(404).json({ code: "NOT_FOUND", message: "Conversation not found." });
    return;
  }

  const accessContext = await buildAccessContext(userId);
  const allowed = canAccessConversation({
    conversation,
    userId,
    role,
    accessContext
  });

  if (!allowed) {
    res.status(403).json({ code: "FORBIDDEN", message: "No access to this conversation." });
    return;
  }

  const message = await prisma.message.create({
    data: {
      conversationId: req.params.id,
      senderId: userId,
      body: payload.body,
      attachments: payload.attachments,
      isRead: false
    },
    include: {
      sender: {
        select: {
          firstName: true,
          lastName: true,
          role: true
        }
      }
    }
  });

  await prisma.conversation.update({
    where: { id: req.params.id },
    data: { updatedAt: new Date() }
  });

  await writeAuditLog({
    actorUserId: req.auth?.userId,
    action: "MESSAGE_SENT",
    entity: "Message",
    entityId: message.id,
    after: {
      conversationId: message.conversationId,
      flagged: message.flagged
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"]
  });

  res.status(201).json({
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    senderName: `${message.sender.firstName} ${message.sender.lastName}`,
    senderRole: message.sender.role,
    body: message.body,
    attachments: message.attachments,
    isRead: message.isRead,
    readAt: message.readAt,
    flagged: message.flagged,
    createdAt: message.createdAt
  });
});

messagingRouter.post("/conversations/:id/read", async (req, res) => {
  const userId = req.auth!.userId;
  const role = req.auth!.role;
  const conversation = await prisma.conversation.findUnique({
    where: { id: req.params.id }
  });

  if (!conversation || conversation.deletedAt) {
    res.status(404).json({ code: "NOT_FOUND", message: "Conversation not found." });
    return;
  }

  const accessContext = await buildAccessContext(userId);
  const allowed = canAccessConversation({
    conversation,
    userId,
    role,
    accessContext
  });

  if (!allowed) {
    res.status(403).json({ code: "FORBIDDEN", message: "No access to this conversation." });
    return;
  }

  const result = await prisma.message.updateMany({
    where: {
      conversationId: req.params.id,
      senderId: { not: userId },
      isRead: false,
      deletedAt: null
    },
    data: {
      isRead: true,
      readAt: new Date()
    }
  });

  res.json({ ok: true, updated: result.count });
});
