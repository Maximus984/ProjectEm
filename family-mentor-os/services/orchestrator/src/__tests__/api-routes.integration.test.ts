import request from "supertest";
import { createApp } from "../app";

const mockService = {
  startAttempt: jest.fn().mockResolvedValue({
    attempt: { id: "a1", breakUsed: false },
    test: { id: "t1", title: "T", sections: [] }
  }),
  saveAnswer: jest.fn().mockResolvedValue({ ok: true }),
  requestBreak: jest.fn().mockResolvedValue({ status: "BREAK" }),
  resumeBreak: jest.fn().mockResolvedValue({ status: "IN_PROGRESS" }),
  heartbeat: jest.fn().mockResolvedValue({ remainingSeconds: 300 }),
  submitAttempt: jest.fn().mockResolvedValue({ status: "SUBMITTED" }),
  getResults: jest.fn().mockResolvedValue({ attemptId: "a1" }),
  compareSubmission: jest.fn().mockResolvedValue({ riskScore: 30 }),
  overrideAttempt: jest.fn().mockResolvedValue({ id: "log1" })
};

describe("API routes", () => {
  it("starts a test attempt", async () => {
    const app = createApp(mockService as never);

    const response = await request(app)
      .post("/api/tests/test-1/start")
      .set("x-dev-user-id", "student-1")
      .set("x-dev-tenant-id", "tenant-1")
      .set("x-dev-role", "STUDENT")
      .send({});

    expect(response.status).toBe(201);
    expect(response.body.attempt.id).toBe("a1");
  });
});
