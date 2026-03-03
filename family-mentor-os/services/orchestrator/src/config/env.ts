import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4100),
  DATABASE_URL: z.string().min(1).default("postgresql://postgres:postgres@localhost:5432/family_mentor_os"),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  JWT_SECRET: z.string().min(8).default("local-dev-secret"),
  BREAK_DURATION_SECONDS: z.coerce.number().int().positive().default(300),
  AI_CHECK_URL: z.string().url(),
  AI_CHECK_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
  RISK_WEIGHTS_JSON: z.string().default('{"similarity":0.28,"stylometry":0.22,"speeding":0.2,"tabBlur":0.12,"webcam":0.08,"paste":0.1}')
});

type RiskWeights = {
  similarity: number;
  stylometry: number;
  speeding: number;
  tabBlur: number;
  webcam: number;
  paste: number;
};

const parsed = envSchema.parse(process.env);

function parseWeights(value: string): RiskWeights {
  try {
    const json = JSON.parse(value) as Partial<RiskWeights>;
    return {
      similarity: json.similarity ?? 0.28,
      stylometry: json.stylometry ?? 0.22,
      speeding: json.speeding ?? 0.2,
      tabBlur: json.tabBlur ?? 0.12,
      webcam: json.webcam ?? 0.08,
      paste: json.paste ?? 0.1
    };
  } catch {
    return {
      similarity: 0.28,
      stylometry: 0.22,
      speeding: 0.2,
      tabBlur: 0.12,
      webcam: 0.08,
      paste: 0.1
    };
  }
}

export const env = {
  ...parsed,
  riskWeights: parseWeights(parsed.RISK_WEIGHTS_JSON)
};
