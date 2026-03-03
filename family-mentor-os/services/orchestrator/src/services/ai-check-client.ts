import axios from "axios";
import { env } from "../config/env";

export type AiCheckResponse = {
  similarity_score: number;
  stylometry_score: number;
  ai_generated_probability: number;
  flags: string[];
  explanation: string;
};

type ComparePayload = {
  text: string;
  prior_submissions: string[];
  cohort_submissions: string[];
};

export async function compareWithAiService(payload: ComparePayload): Promise<AiCheckResponse> {
  const response = await axios.post<AiCheckResponse>(`${env.AI_CHECK_URL}/compare`, payload, {
    timeout: env.AI_CHECK_TIMEOUT_MS,
    headers: {
      "content-type": "application/json"
    }
  });

  return response.data;
}
