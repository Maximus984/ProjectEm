import { isAutoSubmitDue } from "../services/timing";

describe("timer auto-submit", () => {
  it("triggers auto-submit when remaining is zero and not on break", () => {
    const due = isAutoSubmitDue(
      {
        startedAt: new Date("2026-03-03T10:00:00Z"),
        durationSeconds: 60,
        pausedSeconds: 0,
        breakStartedAt: null,
        breakEndsAt: null
      },
      new Date("2026-03-03T10:01:01Z")
    );

    expect(due).toBe(true);
  });

  it("does not auto-submit while break is active", () => {
    const due = isAutoSubmitDue(
      {
        startedAt: new Date("2026-03-03T10:00:00Z"),
        durationSeconds: 60,
        pausedSeconds: 0,
        breakStartedAt: new Date("2026-03-03T10:00:50Z"),
        breakEndsAt: new Date("2026-03-03T10:05:50Z")
      },
      new Date("2026-03-03T10:01:30Z")
    );

    expect(due).toBe(false);
  });
});
