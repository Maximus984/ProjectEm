"use client";

import { io } from "socket.io-client";

const baseUrl = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ?? "http://localhost:4100";

export const socket = io(baseUrl, {
  autoConnect: false
});
