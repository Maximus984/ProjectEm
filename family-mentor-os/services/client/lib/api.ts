import axios from "axios";

const BASE_URL = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ?? "http://localhost:4100";

export function getToken() {
  if (typeof window === "undefined") {
    return "";
  }
  return window.localStorage.getItem("fm_token") ?? "";
}

export function getHeaders() {
  const token = getToken();
  if (token) {
    return {
      Authorization: `Bearer ${token}`
    };
  }

  if (typeof window === "undefined") {
    return {};
  }

  const devUserId = window.localStorage.getItem("fm_user_id") ?? "dev-student-1";
  const devTenantId = window.localStorage.getItem("fm_tenant_id") ?? "dev-tenant-1";
  const devRole = window.localStorage.getItem("fm_role") ?? "STUDENT";

  return {
    "x-dev-user-id": devUserId,
    "x-dev-tenant-id": devTenantId,
    "x-dev-role": devRole
  };
}

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 8000
});

api.interceptors.request.use((config) => {
  const headers = getHeaders();
  config.headers = {
    ...(config.headers ?? {}),
    ...headers
  };
  return config;
});
