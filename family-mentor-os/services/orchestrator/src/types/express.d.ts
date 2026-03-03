import "express";

export type AuthContext = {
  userId: string;
  tenantId: string;
  role: string;
};

declare module "express-serve-static-core" {
  interface Request {
    auth?: AuthContext;
  }
}
