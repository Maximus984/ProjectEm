import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";

function toJsonInput(
  value: unknown
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return Prisma.JsonNull;
  }
  return value as Prisma.InputJsonValue;
}

export async function writeAuditLog(input: {
  actorUserId?: string;
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      before: toJsonInput(input.before),
      after: toJsonInput(input.after),
      ipAddress: input.ipAddress,
      userAgent: input.userAgent
    }
  });
}
