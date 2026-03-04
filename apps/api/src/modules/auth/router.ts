import { Router } from "express";
import {
  authLoginSchema,
  authRegisterSchema,
  refreshTokenSchema,
  type UserRole
} from "@projectm/contracts";
import { prisma } from "../../config/prisma.js";
import { validateBody } from "../../middleware/validate.js";
import { sha256 } from "../../utils/hash.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken
} from "../../utils/token.js";
import { requireAuth } from "../../middleware/auth.js";

export const authRouter = Router();

async function issueTokens(user: {
  id: string;
  email: string;
  role: UserRole;
}) {
  const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
  const refreshToken = signRefreshToken({ sub: user.id });
  const refreshHash = sha256(refreshToken);

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: refreshHash,
      expiresAt
    }
  });

  return { accessToken, refreshToken, expiresInSeconds: 900 };
}

authRouter.post("/register", validateBody(authRegisterSchema), async (req, res) => {
  const payload = req.body;
  const normalizedChildren = payload.children?.length ? payload.children : payload.child ? [payload.child] : [];

  const existing = await prisma.user.findUnique({ where: { email: payload.email } });
  if (existing) {
    res.status(409).json({ code: "EMAIL_TAKEN", message: "Email already in use." });
    return;
  }

  if (payload.coParent?.email && payload.coParent.email === payload.email) {
    res.status(400).json({ code: "INVALID_INPUT", message: "Co-parent email must be different from primary parent." });
    return;
  }

  if (payload.coParent?.email) {
    const existingCoParent = await prisma.user.findUnique({ where: { email: payload.coParent.email } });
    if (existingCoParent) {
      res.status(409).json({ code: "EMAIL_TAKEN", message: "Co-parent email already in use." });
      return;
    }
  }

  const passwordHash = await hashPassword(payload.password);
  const coParentPasswordHash = payload.coParent ? await hashPassword(payload.coParent.password) : null;

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        passwordHash,
        phone: payload.phone,
        role: "FAMILY"
      }
    });

    const family = await tx.family.create({
      data: {
        name: `${payload.lastName} Family`
      }
    });

    await tx.familyMember.create({
      data: {
        familyId: family.id,
        userId: user.id,
        billingRole: "PRIMARY"
      }
    });

    if (payload.coParent) {
      const coParentUser = await tx.user.create({
        data: {
          firstName: payload.coParent.firstName,
          lastName: payload.coParent.lastName,
          email: payload.coParent.email,
          passwordHash: coParentPasswordHash!,
          phone: payload.coParent.phone,
          role: "FAMILY"
        }
      });

      await tx.familyMember.create({
        data: {
          familyId: family.id,
          userId: coParentUser.id,
          billingRole: payload.coParent.billingRole
        }
      });
    }

    const childIds: string[] = [];
    for (const childInput of normalizedChildren) {
      const child = await tx.child.create({
        data: {
          familyId: family.id,
          firstName: childInput.firstName,
          lastName: childInput.lastName,
          dob: childInput.dob ? new Date(childInput.dob) : undefined,
          gradeLevel: childInput.gradeLevel
        }
      });
      childIds.push(child.id);
    }

    return { user, family, childIds };
  });

  const tokens = await issueTokens({
    id: result.user.id,
    email: result.user.email,
    role: result.user.role
  });

  res.status(201).json({
    user: {
      id: result.user.id,
      email: result.user.email,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
      role: result.user.role
    },
    familyId: result.family.id,
    childId: result.childIds[0] ?? null,
    childIds: result.childIds,
    childReminder: result.childIds.length === 0,
    tokens
  });
});

authRouter.post("/login", validateBody(authLoginSchema), async (req, res) => {
  const payload = req.body;
  const user = await prisma.user.findUnique({ where: { email: payload.email } });

  if (!user) {
    res.status(401).json({ code: "INVALID_CREDENTIALS", message: "Invalid email or password." });
    return;
  }

  const valid = await verifyPassword(user.passwordHash, payload.password);
  if (!valid) {
    await prisma.loginHistory.create({
      data: {
        userId: user.id,
        success: false,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"]
      }
    });

    res.status(401).json({ code: "INVALID_CREDENTIALS", message: "Invalid email or password." });
    return;
  }

  // 2FA is disabled; login uses email/password only.

  const tokens = await issueTokens({
    id: user.id,
    email: user.email,
    role: user.role
  });

  await prisma.loginHistory.create({
    data: {
      userId: user.id,
      success: true,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    }
  });

  res.json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      passkeyEnabled: user.passkeyEnabled
    },
    tokens
  });
});

authRouter.post("/refresh", validateBody(refreshTokenSchema), async (req, res) => {
  const { refreshToken } = req.body;

  try {
    const payload = verifyRefreshToken(refreshToken);
    const tokenHash = sha256(refreshToken);

    const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
      res.status(401).json({ code: "REFRESH_INVALID", message: "Refresh token invalid." });
      return;
    }

    await prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() }
    });

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      res.status(401).json({ code: "REFRESH_INVALID", message: "User no longer exists." });
      return;
    }

    const tokens = await issueTokens({ id: user.id, email: user.email, role: user.role });
    res.json(tokens);
  } catch {
    res.status(401).json({ code: "REFRESH_INVALID", message: "Refresh token invalid." });
  }
});

authRouter.post("/logout", validateBody(refreshTokenSchema), async (req, res) => {
  const { refreshToken } = req.body;
  const tokenHash = sha256(refreshToken);

  await prisma.refreshToken.updateMany({
    where: { tokenHash },
    data: { revokedAt: new Date() }
  });

  res.status(204).send();
});

authRouter.post("/webauthn/register", requireAuth, async (_req, res) => {
  res.json({
    message: "Passkey registration challenge endpoint is scaffolded.",
    next: "Integrate @simplewebauthn/server generateRegistrationOptions()"
  });
});

authRouter.post("/webauthn/login", async (_req, res) => {
  res.json({
    message: "Passkey authentication endpoint is scaffolded.",
    next: "Integrate @simplewebauthn/server verifyAuthenticationResponse()"
  });
});
