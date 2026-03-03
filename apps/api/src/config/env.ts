import { config } from "dotenv";
import { z } from "zod";

config({ path: process.env.NODE_ENV === "test" ? ".env.test" : ".env" });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z
    .string()
    .min(1)
    .default("http://localhost:5173")
    .refine(
      (value) =>
        value
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean)
          .every((entry) => z.string().url().safeParse(entry).success),
      "WEB_ORIGIN must be one or more comma-separated valid URLs."
    ),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("7d"),
  COOKIE_SECURE: z
    .union([z.literal("true"), z.literal("false")])
    .transform((value) => value === "true")
    .default("false"),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM: z.string().optional(),
  WEBAUTHN_RP_ID: z.string().default("localhost"),
  WEBAUTHN_RP_ORIGIN: z.string().url().default("http://localhost:5173"),
  WEBAUTHN_RP_NAME: z.string().default("ProjectM"),
  DIAGNOSTIC_ADMIN_KEY: z.string().min(12).default("projectm_diagnostic_admin_key_change_me"),
  DIAGNOSTIC_LOG_ENCRYPTION_KEY: z.string().min(32).optional(),
  OPENAI_API_KEY: z.string().optional()
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
