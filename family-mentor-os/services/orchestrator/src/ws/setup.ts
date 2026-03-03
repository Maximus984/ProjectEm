import type { Server as HttpServer } from "http";
import { Server } from "socket.io";

export function createSocketServer(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "*"
    }
  });

  io.on("connection", (socket) => {
    socket.on("join_attempt", (attemptId: string) => {
      if (attemptId) {
        socket.join(attemptId);
      }
    });

    socket.on("leave_attempt", (attemptId: string) => {
      if (attemptId) {
        socket.leave(attemptId);
      }
    });
  });

  return io;
}
