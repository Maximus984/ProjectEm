import { env } from "../../config/env.js";

type OpenAIEmbeddingResponse = {
  data: Array<{ embedding: number[] }>;
};

export async function fetchEmbeddingVector(text: string): Promise<number[] | null> {
  if (!env.OPENAI_API_KEY) {
    return null;
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text
    })
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as OpenAIEmbeddingResponse;
  return payload.data[0]?.embedding ?? null;
}

export function cosineFromVectors(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (!normA || !normB) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
