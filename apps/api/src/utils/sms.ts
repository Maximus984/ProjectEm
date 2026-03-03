import { env } from "../config/env.js";

let cachedClient: any;

async function getClient(): Promise<any | null> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM) {
    return null;
  }

  if (cachedClient) {
    return cachedClient;
  }

  const twilio = await import("twilio");
  cachedClient = twilio.default(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  return cachedClient;
}

export async function sendCheckinSms(to: string, body: string): Promise<{ sent: boolean; reason?: string }> {
  const client = await getClient();
  if (!client) {
    return { sent: false, reason: "Twilio not configured" };
  }

  await client.messages.create({
    to,
    from: env.TWILIO_FROM,
    body
  });

  return { sent: true };
}
