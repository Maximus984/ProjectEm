import { applyBreakEnd, computeRemainingSeconds } from "../services/timing";

describe("break lifecycle", () => {
  it("pauses timer during break and resumes correctly", () => {
    const start = new Date("2026-03-03T10:00:00Z");
    const breakStart = new Date("2026-03-03T10:01:00Z");
    const nowDuringBreak = new Date("2026-03-03T10:03:00Z");

    const remainingDuringBreak = computeRemainingSeconds(
      {
        startedAt: start,
        durationSeconds: 600,
        pausedSeconds: 0,
        breakStartedAt: breakStart,
        breakEndsAt: new Date("2026-03-03T10:06:00Z")
      },
      nowDuringBreak
    );

    expect(remainingDuringBreak).toBe(540);

    const pausedSeconds = applyBreakEnd(
      {
        pausedSeconds: 0,
        breakStartedAt: breakStart
      },
      new Date("2026-03-03T10:06:00Z")
    );

    expect(pausedSeconds).toBe(300);
  });
});
