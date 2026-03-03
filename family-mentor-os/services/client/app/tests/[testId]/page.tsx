"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "../../../lib/api";
import { socket } from "../../../lib/socket";
import { AutoSaveBadge } from "../../../components/AutoSaveBadge";
import { BreakControl } from "../../../components/BreakControl";
import { TimerDisplay } from "../../../components/TimerDisplay";

type Item = {
  id: string;
  prompt: string;
  itemType: string;
  expectedTime: number;
};

type TestStartResponse = {
  attempt: {
    id: string;
    breakUsed: boolean;
  };
  test: {
    id: string;
    title: string;
    sections: Array<{
      id: string;
      title: string;
      items: Item[];
    }>;
  };
};

export default function TestRunnerPage() {
  const params = useParams<{ testId: string }>();
  const router = useRouter();
  const testId = params.testId;

  const [attemptId, setAttemptId] = useState<string>("");
  const [title, setTitle] = useState("Diagnostic Test");
  const [items, setItems] = useState<Item[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [breakUsed, setBreakUsed] = useState(false);
  const [inBreak, setInBreak] = useState(false);
  const [breakRemaining, setBreakRemaining] = useState(0);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [showBreakConfirm, setShowBreakConfirm] = useState(false);

  const questionStartRef = useRef<number>(Date.now());

  const currentItem = items[currentIndex];

  const canSubmit = useMemo(() => Boolean(attemptId && items.length > 0), [attemptId, items.length]);

  useEffect(() => {
    let ignore = false;

    async function start() {
      const { data } = await api.post<TestStartResponse>(`/api/tests/${testId}/start`, {});
      if (ignore) {
        return;
      }

      setAttemptId(data.attempt.id);
      setBreakUsed(data.attempt.breakUsed);
      setTitle(data.test.title);
      const flattened = data.test.sections.flatMap((section) => section.items);
      setItems(flattened);
      setCurrentIndex(0);
      questionStartRef.current = Date.now();

      socket.connect();
      socket.emit("join_attempt", data.attempt.id);
    }

    start().catch(() => undefined);

    return () => {
      ignore = true;
    };
  }, [testId]);

  useEffect(() => {
    const onTick = (payload: { attemptId: string; remainingSeconds: number }) => {
      if (payload.attemptId !== attemptId) {
        return;
      }
      setRemainingSeconds(payload.remainingSeconds);
    };

    const onBreakStarted = (payload: { attemptId: string }) => {
      if (payload.attemptId !== attemptId) {
        return;
      }
      setBreakUsed(true);
      setInBreak(true);
    };

    const onBreakCountdown = (payload: { attemptId: string; remainingSeconds: number }) => {
      if (payload.attemptId !== attemptId) {
        return;
      }
      setBreakRemaining(payload.remainingSeconds);
    };

    const onBreakEnded = (payload: { attemptId: string }) => {
      if (payload.attemptId !== attemptId) {
        return;
      }
      setInBreak(false);
      setBreakRemaining(0);
      questionStartRef.current = Date.now();
    };

    const onAutoSubmit = (payload: { attemptId: string }) => {
      if (payload.attemptId !== attemptId) {
        return;
      }
      router.replace(`/attempts/${attemptId}/results`);
    };

    socket.on("tick", onTick);
    socket.on("break_started", onBreakStarted);
    socket.on("break_countdown", onBreakCountdown);
    socket.on("break_ended", onBreakEnded);
    socket.on("auto_submit", onAutoSubmit);

    return () => {
      socket.off("tick", onTick);
      socket.off("break_started", onBreakStarted);
      socket.off("break_countdown", onBreakCountdown);
      socket.off("break_ended", onBreakEnded);
      socket.off("auto_submit", onAutoSubmit);
    };
  }, [attemptId, router]);

  useEffect(() => {
    if (!attemptId || !currentItem || inBreak) {
      return;
    }

    const interval = window.setInterval(async () => {
      setSaveStatus("saving");
      try {
        await api.post(`/api/tests/${testId}/answer`, {
          attemptId,
          itemId: currentItem.id,
          answer: answers[currentItem.id] ?? "(no answer)",
          timeSpentSec: Math.max(0, Math.floor((Date.now() - questionStartRef.current) / 1000))
        });

        await api.post(`/api/tests/${testId}/heartbeat`, {
          attemptId,
          eventType: "heartbeat",
          metadata: { autosave: true }
        });

        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [attemptId, answers, currentItem, inBreak, testId]);

  useEffect(() => {
    if (!attemptId) {
      return;
    }

    const onVisibility = () => {
      const eventType = document.hidden ? "tab_blur" : "tab_focus";
      void api.post(`/api/tests/${testId}/heartbeat`, {
        attemptId,
        eventType,
        metadata: { source: "visibilitychange" }
      });
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [attemptId, testId]);

  async function submitAttempt() {
    if (!canSubmit) {
      return;
    }

    await api.post(`/api/tests/${testId}/submit`, { attemptId });
    router.replace(`/attempts/${attemptId}/results`);
  }

  async function requestBreak() {
    await api.post(`/api/tests/${testId}/break`, { attemptId });
    setShowBreakConfirm(false);
  }

  async function resumeBreak() {
    await api.post(`/api/tests/${testId}/resume`, { attemptId });
  }

  return (
    <main className="container" style={{ display: "grid", gap: 16 }}>
      <section className="panel" style={{ display: "grid", gap: 8 }}>
        <h1 style={{ margin: 0 }}>{title}</h1>
        <p className="muted">Adaptive diagnostic attempt with server timer, one break, auto-save, and telemetry.</p>
      </section>

      <section style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <TimerDisplay seconds={remainingSeconds} />
        <BreakControl
          used={breakUsed}
          inBreak={inBreak}
          breakRemaining={breakRemaining}
          onRequestBreak={() => setShowBreakConfirm(true)}
          onResume={() => void resumeBreak()}
        />
        <div className="panel" style={{ display: "grid", gap: 8 }}>
          <p className="muted" style={{ margin: 0 }}>Auto-save and heartbeat</p>
          <AutoSaveBadge status={saveStatus} />
        </div>
      </section>

      <section className="panel" style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <strong>
            Question {currentIndex + 1}/{items.length || 1}
          </strong>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {items.map((item, index) => (
              <button
                className="button"
                key={item.id}
                onClick={() => {
                  setCurrentIndex(index);
                  questionStartRef.current = Date.now();
                }}
                type="button"
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>

        {currentItem ? (
          <>
            <p style={{ marginBottom: 0 }}>{currentItem.prompt}</p>
            <textarea
              className="textarea"
              value={answers[currentItem.id] ?? ""}
              disabled={inBreak}
              onChange={(event) => {
                setAnswers((prev) => ({
                  ...prev,
                  [currentItem.id]: event.target.value
                }));
              }}
              rows={5}
            />
          </>
        ) : (
          <p className="muted">Loading questions...</p>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="button"
            type="button"
            disabled={currentIndex === 0}
            onClick={() => {
              setCurrentIndex((value) => Math.max(0, value - 1));
              questionStartRef.current = Date.now();
            }}
          >
            Previous
          </button>
          <button
            className="button"
            type="button"
            disabled={currentIndex >= items.length - 1}
            onClick={() => {
              setCurrentIndex((value) => Math.min(items.length - 1, value + 1));
              questionStartRef.current = Date.now();
            }}
          >
            Next
          </button>
          <button className="button primary" type="button" onClick={() => void submitAttempt()} disabled={!canSubmit}>
            Submit Attempt
          </button>
        </div>
      </section>

      {showBreakConfirm ? (
        <section className="panel" style={{ borderColor: "rgba(255, 179, 92, 0.45)", display: "grid", gap: 8 }}>
          <p style={{ margin: 0 }}>Confirm break request? You only get one 5-minute break this attempt.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="button" type="button" onClick={() => setShowBreakConfirm(false)}>
              Cancel
            </button>
            <button className="button primary" type="button" onClick={() => void requestBreak()}>
              Confirm Break
            </button>
          </div>
        </section>
      ) : null}
    </main>
  );
}
