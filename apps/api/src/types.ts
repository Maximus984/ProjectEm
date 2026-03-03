import type { Request } from "express";
import type { UserRole } from "@projectm/contracts";

export type AuthContext = {
  userId: string;
  email: string;
  role: UserRole;
};

export type RequestWithAuth = Request & {
  auth?: AuthContext;
  requestId?: string;
};
