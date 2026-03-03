import type { AiCheck } from "@prisma/client";
import { env } from "../config/env";

type RiskInput = {
  similarityScore: number;
  stylometryScore: number;
  speedingFlag: number;
  tabBlurScore: number;
  webcamFlag: number;
  pasteEvents: number;
};

export function normalizeScore(raw: number): number {
  if (Number.isNaN(raw)) {
    return 0;
  }
  return Math.min(100, Math.max(0, raw));
}

export function calculateRiskScore(input: RiskInput): number {
  const w = env.riskWeights;
  const pasteScore = Math.min(100, input.pasteEvents * 20);

  const weighted =
    w.similarity * normalizeScore(input.similarityScore) +
    w.stylometry * normalizeScore(input.stylometryScore) +
    w.speeding * normalizeScore(input.speedingFlag) +
    w.tabBlur * normalizeScore(input.tabBlurScore) +
    w.webcam * normalizeScore(input.webcamFlag) +
    w.paste * normalizeScore(pasteScore);

  return Math.round(normalizeScore(weighted));
}

export function topRiskSignals(record: Pick<AiCheck, "similarityScore" | "stylometryScore" | "speedingFlag" | "tabBlurScore" | "pasteEvents">) {
  const rows = [
    { signal: "similarity", score: record.similarityScore },
    { signal: "stylometry", score: record.stylometryScore },
    { signal: "speeding", score: record.speedingFlag },
    { signal: "tab_blur", score: record.tabBlurScore },
    { signal: "paste_events", score: Math.min(100, record.pasteEvents * 20) }
  ];

  return rows.sort((a, b) => b.score - a.score).slice(0, 3);
}
