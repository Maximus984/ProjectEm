import { type UserRole } from "@projectm/contracts";
import type { NextFunction, Response } from "express";
import { prisma } from "../config/prisma.js";
import type { RequestWithAuth } from "../types.js";

function getClientIp(req: RequestWithAuth): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }

  return req.ip || req.socket.remoteAddress || "unknown";
}

function getHourInTimezone(date: Date, timezone: string): number {
  const hourString = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hour12: false,
    timeZone: timezone
  }).format(date);

  return Number.parseInt(hourString, 10);
}

function isInsideWindow(hour: number, start: number, end: number): boolean {
  if (start === end) {
    return true;
  }

  if (start < end) {
    return hour >= start && hour < end;
  }

  return hour >= start || hour < end;
}

function resolveRoleWindow(policy: {
  ownerStartHour: number;
  ownerEndHour: number;
  managerStartHour: number;
  managerEndHour: number;
  mediumStartHour: number;
  mediumEndHour: number;
  monitorStartHour: number;
  monitorEndHour: number;
  mentorStartHour: number;
  mentorEndHour: number;
  clientStartHour: number;
  clientEndHour: number;
  familyStartHour: number;
  familyEndHour: number;
}, role: UserRole): { start: number; end: number } {
  switch (role) {
    case "OWNER":
      return { start: policy.ownerStartHour, end: policy.ownerEndHour };
    case "MANAGER":
      return { start: policy.managerStartHour, end: policy.managerEndHour };
    case "MEDIUM":
      return { start: policy.mediumStartHour, end: policy.mediumEndHour };
    case "MONITOR":
      return { start: policy.monitorStartHour, end: policy.monitorEndHour };
    case "MENTOR":
      return { start: policy.mentorStartHour, end: policy.mentorEndHour };
    case "CLIENT":
      return { start: policy.clientStartHour, end: policy.clientEndHour };
    default:
      return { start: policy.familyStartHour, end: policy.familyEndHour };
  }
}

export async function enforceIpBan(req: RequestWithAuth, res: Response, next: NextFunction): Promise<void> {
  const ipAddress = getClientIp(req);

  try {
    const ban = await prisma.ipBan.findFirst({
      where: {
        ipAddress,
        deletedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
      }
    });

    if (ban) {
      res.status(403).json({
        code: "IP_BANNED",
        message: "Your IP address is blocked from accessing this workspace.",
        expiresAt: ban.expiresAt
      });
      return;
    }
  } catch (error) {
    console.warn("IP ban check failed, continuing request:", error);
  }

  next();
}

export async function enforceWorkspaceHours(req: RequestWithAuth, res: Response, next: NextFunction): Promise<void> {
  if (!req.auth) {
    next();
    return;
  }

  try {
    const policy = await prisma.workspacePolicy.findUnique({ where: { id: "default" } });
    if (!policy || !policy.enabled) {
      next();
      return;
    }

    const role = req.auth.role;
    if (role === "OWNER" || role === "ADMIN") {
      next();
      return;
    }

    const hour = getHourInTimezone(new Date(), policy.timezone);
    const { start, end } = resolveRoleWindow(policy, role);

    if (!isInsideWindow(hour, start, end)) {
      res.status(403).json({
        code: "OUTSIDE_WORKSPACE_HOURS",
        message: `Role ${role} is limited to workspace hours ${start}:00-${end}:00 (${policy.timezone}).`
      });
      return;
    }
  } catch (error) {
    console.warn("Workspace-hours check failed, continuing request:", error);
  }

  next();
}
