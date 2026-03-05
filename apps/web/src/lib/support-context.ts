export const SUPPORT_CONTEXT_EVENT = "projectm:support-context";

export type SupportContextPayload = {
  title?: string;
  message: string;
  source?: "api" | "runtime";
  endpoint?: string;
  status?: number;
  timestamp?: string;
};

export function dispatchSupportContext(payload: SupportContextPayload) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<SupportContextPayload>(SUPPORT_CONTEXT_EVENT, {
      detail: {
        ...payload,
        timestamp: payload.timestamp ?? new Date().toISOString()
      }
    })
  );
}
