import {
  isAdminRole,
  type DiagnosticConfidence,
  type DiagnosticQuestion,
  type DiagnosticTool
} from "@projectm/contracts";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useUiSound } from "../hooks/use-ui-sound";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth-store";

type StudentResult = {
  attempt_id: string;
  final_score: number;
  subject_breakdown: Record<string, number>;
  effort_score: number;
  engagement_score: number;
  confidence_accuracy_score?: number;
  overconfidence_index?: number;
  recommendation: string;
};

type ProctorAttemptView = {
  student_id: string;
  student_name: string;
  student_email: string;
  attempt_id: string;
  final_score: number;
  speeding_score: number;
  ai_similarity_score: number;
  effort_score: number;
  engagement_score: number;
  integrity_score: number;
  integrity_band: string;
  flag_reason: string;
  flagged_questions: Array<{ question_id: string; flag_reason: string; score: number }>;
  break_summary: { count: number; total_seconds: number; breaks_exceeded: boolean };
  focus_summary: { hidden_events: number; visible_events: number };
  performance_trend: Record<string, unknown>;
  evidence: Record<string, unknown>;
};

type DiagnosticAssignment = {
  assignmentId: string;
  attemptId: string;
  grade: number;
  label: string;
  status: string;
  child: {
    id: string;
    firstName: string;
    lastName: string;
    gradeLevel?: string | null;
  } | null;
  assignedAt: string;
  submittedAt: string | null;
  isStartable: boolean;
};

const gradeOptions = [7, 8, 9, 10, 11, 12];
const maxBreaks = 2;
const breakSecondsPerBreak = 120;
const maxBreakSeconds = maxBreaks * breakSecondsPerBreak;
const diagnosticDurationSeconds = 20 * 60;

const confidenceOptions: Array<{ value: DiagnosticConfidence; label: string }> = [
  { value: "very_confident", label: "Very confident" },
  { value: "somewhat_confident", label: "Somewhat confident" },
  { value: "guessing", label: "Guessing" }
];

const toolLabels: Record<DiagnosticTool, string> = {
  calculator: "Calculator",
  ruler: "Ruler",
  protractor: "Protractor",
  scratchpad: "Scratchpad",
  formula_sheet: "Formula Sheet",
  graph_grid: "Graph Grid"
};

function secondsToClock(value: number): string {
  const minutes = Math.floor(value / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(value % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function safeNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function DiagnosticPage() {
  const token = useAuthStore((state) => state.accessToken);
  const role = useAuthStore((state) => state.role);
  const email = useAuthStore((state) => state.email);
  const { playTap, playSuccess } = useUiSound();
  const [searchParams] = useSearchParams();
  const isAdmin = Boolean(role && isAdminRole(role));

  const [grade, setGrade] = useState(7);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [firstInteraction, setFirstInteraction] = useState<Record<string, boolean>>({});
  const [pasteEvents, setPasteEvents] = useState<Record<string, boolean>>({});
  const [confidenceByQuestion, setConfidenceByQuestion] = useState<Record<string, DiagnosticConfidence>>({});
  const [openToolsByQuestion, setOpenToolsByQuestion] = useState<Record<string, DiagnosticTool[]>>({});
  const [toolOpenStartByQuestion, setToolOpenStartByQuestion] = useState<
    Record<string, Partial<Record<DiagnosticTool, number>>>
  >({});
  const [scratchpadByQuestion, setScratchpadByQuestion] = useState<Record<string, string>>({});
  const [calculatorExpressionByQuestion, setCalculatorExpressionByQuestion] = useState<Record<string, string>>({});
  const [calculatorResultByQuestion, setCalculatorResultByQuestion] = useState<Record<string, string>>({});
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isBreak, setIsBreak] = useState(false);
  const [breakStartTime, setBreakStartTime] = useState<number | null>(null);
  const [breakSecondsCurrent, setBreakSecondsCurrent] = useState(0);
  const [breakCount, setBreakCount] = useState(0);
  const [breakSecondsTotal, setBreakSecondsTotal] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [studentResult, setStudentResult] = useState<StudentResult | null>(null);

  const [adminKey, setAdminKey] = useState("");
  const [adminAttemptId, setAdminAttemptId] = useState("");
  const [adminReason, setAdminReason] = useState("Manual review requested.");
  const [adminNotes, setAdminNotes] = useState("Reviewed by proctor.");
  const [adminView, setAdminView] = useState<ProctorAttemptView | null>(null);
  const [adminAnswers, setAdminAnswers] = useState<Array<{ question_id: string; answer: string }>>([]);
  const [autoStartHandled, setAutoStartHandled] = useState(false);
  const [introVisible, setIntroVisible] = useState(true);
  const autoResumedBreakRef = useRef(false);
  const autoSubmitTriggeredRef = useRef(false);

  const assignmentsQuery = useQuery({
    queryKey: ["diagnostic-assignments", token, role],
    queryFn: () => api<{ assignments: DiagnosticAssignment[] }>("/diagnostic/assignments", { token: token ?? undefined }),
    enabled: Boolean(token),
    refetchInterval: 3000
  });

  const activeQuestion = questions[index] ?? null;
  const isAttemptInProgress = Boolean(attemptId && !studentResult);
  const remainingSeconds = Math.max(0, diagnosticDurationSeconds - timerSeconds);
  const isLastFiveMinutes = remainingSeconds <= 300;
  const progressText = useMemo(
    () => (questions.length ? `${index + 1} / ${questions.length}` : "0 / 0"),
    [index, questions.length]
  );

  async function runtimeRequest<T>(payload: Record<string, unknown>): Promise<T> {
    return api<T>("/diagnostic/runtime", {
      method: "POST",
      token: token ?? undefined,
      body: JSON.stringify(payload)
    });
  }

  async function recordEvent(event: Record<string, unknown>, explicitAttemptId?: string): Promise<void> {
    const eventAttemptId = explicitAttemptId ?? attemptId;
    if (!eventAttemptId || !token) {
      return;
    }
    await runtimeRequest<{ ok: boolean }>({
      action: "record_event",
      event: {
        ...event,
        attempt_id: eventAttemptId
      }
    });
  }

  async function showQuestion(nextIndex: number): Promise<void> {
    const next = questions[nextIndex];
    setIndex(nextIndex);
    if (!next || !attemptId) {
      return;
    }
    await recordEvent({
      event_type: "question_shown",
      attempt_id: attemptId,
      question_id: next.question_id,
      shown_time: new Date().toISOString()
    });
  }

  async function initializeDiagnostic(params: { grade: number; attemptId: string; testId: string }): Promise<void> {
    setErrorMessage(null);
    setStatusMessage(null);
    setStudentResult(null);
    if (!token) {
      setErrorMessage("You must be logged in to start diagnostics.");
      return;
    }

    try {
      const questionPayload = await runtimeRequest<{ grade: number; questions: DiagnosticQuestion[] }>({
        action: "get_questions",
        grade: params.grade
      });

      setQuestions(questionPayload.questions);
      setAttemptId(params.attemptId);
      setGrade(params.grade);
      setIntroVisible(false);
      setAnswers({});
      setFirstInteraction({});
      setPasteEvents({});
      setConfidenceByQuestion({});
      setOpenToolsByQuestion({});
      setToolOpenStartByQuestion({});
      setScratchpadByQuestion({});
      setCalculatorExpressionByQuestion({});
      setCalculatorResultByQuestion({});
      setTimerSeconds(0);
      setIsBreak(false);
      setBreakStartTime(null);
      setBreakSecondsCurrent(0);
      setBreakCount(0);
      setBreakSecondsTotal(0);
      autoResumedBreakRef.current = false;
      autoSubmitTriggeredRef.current = false;

      await recordEvent(
        {
        event_type: "attempt_start",
        student_id: email ?? "student",
        grade: params.grade,
        test_id: params.testId,
        start_time: new Date().toISOString(),
        userAgent: navigator.userAgent
        },
        params.attemptId
      );

      if (questionPayload.questions.length > 0) {
      await recordEvent(
        {
          event_type: "question_shown",
          question_id: questionPayload.questions[0].question_id,
          shown_time: new Date().toISOString()
        },
        params.attemptId
      );
      }
      setStatusMessage("Diagnostic started.");
      playSuccess();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to start diagnostic.");
    }
  }

  async function startDiagnostic(): Promise<void> {
    const generatedAttemptId = crypto.randomUUID();
    await initializeDiagnostic({
      grade,
      attemptId: generatedAttemptId,
      testId: "projectm_diagnostic_v1"
    });
  }

  async function startAssignedDiagnostic(assignment: DiagnosticAssignment): Promise<void> {
    await initializeDiagnostic({
      grade: assignment.grade,
      attemptId: assignment.attemptId,
      testId: `assigned_${assignment.assignmentId}`
    });
    await assignmentsQuery.refetch();
  }

  async function saveAnswer(isFinal: boolean): Promise<void> {
    if (!attemptId || !activeQuestion || isBreak) {
      return;
    }
    const answer = answers[activeQuestion.question_id] ?? "";
    const confidence = confidenceByQuestion[activeQuestion.question_id];
    await recordEvent({
      event_type: "answer_save",
      attempt_id: attemptId,
      question_id: activeQuestion.question_id,
      answer,
      time: new Date().toISOString(),
      is_final: isFinal,
      paste_event: pasteEvents[activeQuestion.question_id] ?? false,
      confidence
    });
  }

  async function submitAttempt(): Promise<void> {
    if (!attemptId) {
      return;
    }
    setErrorMessage(null);
    try {
      await saveAnswer(true);
      await recordEvent({
        event_type: "attempt_submit",
        attempt_id: attemptId,
        end_time: new Date().toISOString()
      });

      const result = await runtimeRequest<StudentResult>({
        action: "submit_attempt",
        attempt_id: attemptId
      });
      setStudentResult(result);
      autoSubmitTriggeredRef.current = false;
      await assignmentsQuery.refetch();
      setStatusMessage("Attempt submitted.");
      if (isAdmin) {
        setAdminAttemptId(result.attempt_id);
      }
    } catch (error) {
      autoSubmitTriggeredRef.current = false;
      setErrorMessage(error instanceof Error ? error.message : "Submit failed.");
    }
  }

  async function takeBreak(): Promise<void> {
    if (!attemptId || isBreak) {
      return;
    }
    if (breakCount >= maxBreaks || breakSecondsTotal >= maxBreakSeconds) {
      setErrorMessage("Break limit reached.");
      return;
    }
    if (isLastFiveMinutes) {
      setErrorMessage("Breaks are disabled during the final 5 minutes.");
      return;
    }
    setIsBreak(true);
    setBreakCount((value) => value + 1);
    setBreakStartTime(Date.now());
    setBreakSecondsCurrent(0);
    autoResumedBreakRef.current = false;

    await recordEvent({
      event_type: "break_start",
      attempt_id: attemptId,
      start_time: new Date().toISOString()
    });
    playTap();
  }

  async function resumeBreak(): Promise<void> {
    if (!attemptId || !isBreak) {
      return;
    }
    const now = Date.now();
    const elapsed = breakStartTime ? Math.max(0, Math.round((now - breakStartTime) / 1000)) : 0;
    const delta = Math.min(elapsed, breakSecondsPerBreak);
    setBreakSecondsTotal((value) => value + delta);
    setBreakStartTime(null);
    setIsBreak(false);
    setBreakSecondsCurrent(0);
    autoResumedBreakRef.current = false;

    await recordEvent({
      event_type: "break_end",
      attempt_id: attemptId,
      end_time: new Date().toISOString()
    });
    playTap();
  }

  async function readResults(): Promise<void> {
    if (!attemptId) {
      return;
    }
    try {
      const payload = await api<{ summary_text: string }>(`/diagnostic/attempts/${attemptId}/results-summary`, {
        method: "GET",
        token: token ?? undefined
      });
      const utterance = new SpeechSynthesisUtterance(payload.summary_text);
      utterance.lang = "en-US";
      utterance.rate = 1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      playSuccess();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to read results.");
    }
  }

  function speakQuestionAndOptions(): void {
    if (!activeQuestion) {
      return;
    }
    const choicesText =
      activeQuestion.type === "mcq" && activeQuestion.choices?.length
        ? ` Choices are: ${activeQuestion.choices.map((choice, idx) => `Option ${idx + 1}, ${choice}`).join(". ")}.`
        : "";
    const text = `${activeQuestion.subject} question. ${activeQuestion.stem}.${choicesText}`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    playTap();
  }

  function speakCurrentAnswer(): void {
    if (!activeQuestion) {
      return;
    }
    const answer = (answers[activeQuestion.question_id] ?? "").trim();
    const text = answer.length > 0 ? `Your current answer is: ${answer}` : "You have not entered an answer yet.";
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    playTap();
  }

  async function openAdminAttempt(): Promise<void> {
    if (!adminAttemptId.trim()) {
      setErrorMessage("Enter attempt id.");
      return;
    }
    try {
      const payload = await api<ProctorAttemptView>(`/diagnostic/admin/attempts/${adminAttemptId.trim()}`, {
        method: "GET",
        token: token ?? undefined
      });
      setAdminView(payload);
      setStatusMessage("Loaded proctor attempt view.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load proctor view.");
    }
  }

  async function adminReassign(): Promise<void> {
    if (!adminAttemptId.trim()) {
      return;
    }
    try {
      const payload = await api<{ new_attempt_id: string }>(`/diagnostic/admin/attempts/${adminAttemptId.trim()}/reassign`, {
        method: "POST",
        token: token ?? undefined,
        body: JSON.stringify({
          reason: adminReason,
          shuffleQuestions: true,
          disableBreak: false,
          strictFocusMode: true,
          forceProctoring: true
        })
      });
      setStatusMessage(`Reassigned. New attempt: ${payload.new_attempt_id}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Reassign failed.");
    }
  }

  async function adminMarkReviewed(): Promise<void> {
    if (!adminAttemptId.trim()) {
      return;
    }
    try {
      await api<{ ok: boolean }>(`/diagnostic/admin/attempts/${adminAttemptId.trim()}/mark_reviewed`, {
        method: "POST",
        token: token ?? undefined,
        body: JSON.stringify({
          verdict: "valid_attempt",
          notes: adminNotes
        })
      });
      setStatusMessage("Marked reviewed.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Mark reviewed failed.");
    }
  }

  async function adminLockStudent(): Promise<void> {
    if (!adminAttemptId.trim()) {
      return;
    }
    try {
      await api<{ ok: boolean }>(`/diagnostic/admin/attempts/${adminAttemptId.trim()}/lock_student`, {
        method: "POST",
        token: token ?? undefined,
        body: JSON.stringify({
          reason: adminReason
        })
      });
      setStatusMessage("Student locked for diagnostics.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Lock student failed.");
    }
  }

  async function adminSendParentReport(): Promise<void> {
    if (!adminAttemptId.trim()) {
      return;
    }
    try {
      await api<{ ok: boolean }>(`/diagnostic/admin/attempts/${adminAttemptId.trim()}/send_parent_report`, {
        method: "POST",
        token: token ?? undefined,
        body: JSON.stringify({
          deliveryChannel: "EMAIL"
        })
      });
      setStatusMessage("Parent report queued.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Parent report failed.");
    }
  }

  async function adminGetAnswers(): Promise<void> {
    if (isAttemptInProgress) {
      setErrorMessage("Answer key is unavailable while a test is in progress.");
      return;
    }
    if (!adminKey || !isAdmin) {
      setErrorMessage("Admin key required.");
      return;
    }
    try {
      const payload = await runtimeRequest<{ answers: Array<{ question_id: string; answer: string }> }>({
        action: "get_answers",
        grade,
        auth: adminKey
      });
      setAdminAnswers(payload.answers);
      setStatusMessage("Answer key loaded.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load answer key.");
    }
  }

  function evaluateCalculatorExpression(questionId: string): void {
    const expression = (calculatorExpressionByQuestion[questionId] ?? "").trim();
    if (!expression) {
      setCalculatorResultByQuestion((prev) => ({ ...prev, [questionId]: "" }));
      return;
    }

    const safePattern = /^[0-9+\-*/().\s]+$/;
    if (!safePattern.test(expression)) {
      setCalculatorResultByQuestion((prev) => ({ ...prev, [questionId]: "Invalid expression" }));
      return;
    }

    try {
      const value = Function(`"use strict"; return (${expression});`)() as number;
      if (!Number.isFinite(value)) {
        setCalculatorResultByQuestion((prev) => ({ ...prev, [questionId]: "Invalid expression" }));
        return;
      }
      setCalculatorResultByQuestion((prev) => ({ ...prev, [questionId]: String(value) }));
      void recordEvent({
        event_type: "tool_usage",
        question_id: questionId,
        tool: "calculator",
        action: "used",
        time: new Date().toISOString()
      });
    } catch {
      setCalculatorResultByQuestion((prev) => ({ ...prev, [questionId]: "Invalid expression" }));
    }
  }

  function toggleTool(questionId: string, tool: DiagnosticTool): void {
    const now = Date.now();
    const openTools = openToolsByQuestion[questionId] ?? [];
    const isOpen = openTools.includes(tool);
    const openedAt = toolOpenStartByQuestion[questionId]?.[tool];

    if (isOpen) {
      const durationSeconds = openedAt ? Math.max(0, Math.round((now - openedAt) / 1000)) : 0;
      setOpenToolsByQuestion((prev) => ({
        ...prev,
        [questionId]: (prev[questionId] ?? []).filter((item) => item !== tool)
      }));
      setToolOpenStartByQuestion((prev) => {
        const next = { ...(prev[questionId] ?? {}) };
        delete next[tool];
        return { ...prev, [questionId]: next };
      });
      void recordEvent({
        event_type: "tool_usage",
        question_id: questionId,
        tool,
        action: "close",
        duration_seconds: durationSeconds,
        time: new Date().toISOString()
      });
      return;
    }

    setOpenToolsByQuestion((prev) => ({
      ...prev,
      [questionId]: [...(prev[questionId] ?? []), tool]
    }));
    setToolOpenStartByQuestion((prev) => ({
      ...prev,
      [questionId]: { ...(prev[questionId] ?? {}), [tool]: now }
    }));
    void recordEvent({
      event_type: "tool_usage",
      question_id: questionId,
      tool,
      action: "open",
      time: new Date().toISOString()
    });
  }

  useEffect(() => {
    if (!attemptId || isBreak || studentResult) {
      return;
    }
    const timer = window.setInterval(() => {
      setTimerSeconds((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [attemptId, isBreak, studentResult]);

  useEffect(() => {
    if (!attemptId || !isBreak || !breakStartTime) {
      return;
    }
    const timer = window.setInterval(() => {
      const elapsed = Math.max(0, Math.round((Date.now() - breakStartTime) / 1000));
      setBreakSecondsCurrent(Math.min(elapsed, breakSecondsPerBreak));
      if (elapsed >= breakSecondsPerBreak && !autoResumedBreakRef.current) {
        autoResumedBreakRef.current = true;
        void resumeBreak();
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [attemptId, breakStartTime, isBreak]);

  useEffect(() => {
    if (!attemptId || !isAttemptInProgress || isBreak) {
      return;
    }
    if (timerSeconds < diagnosticDurationSeconds) {
      return;
    }
    if (autoSubmitTriggeredRef.current) {
      return;
    }
    autoSubmitTriggeredRef.current = true;
    setStatusMessage("Time limit reached. Auto-submitting attempt.");
    void submitAttempt();
  }, [attemptId, isAttemptInProgress, isBreak, timerSeconds]);

  useEffect(() => {
    const handler = async () => {
      if (!attemptId) {
        return;
      }
      await recordEvent({
        event_type: "focus_change",
        attempt_id: attemptId,
        event: document.hidden ? "hidden" : "visible",
        time: new Date().toISOString()
      });
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [attemptId]);

  useEffect(() => {
    if (autoStartHandled || !token) {
      return;
    }

    const requestedAttempt = searchParams.get("attempt");
    const requestedGrade = Number(searchParams.get("grade") ?? "");
    if (!Number.isNaN(requestedGrade) && requestedGrade >= 7 && requestedGrade <= 12) {
      setGrade(requestedGrade);
    }

    if (!requestedAttempt) {
      setAutoStartHandled(true);
      return;
    }

    if (!assignmentsQuery.data) {
      return;
    }

    const assignment = assignmentsQuery.data.assignments.find((item) => item.attemptId === requestedAttempt);
    if (assignment && !attemptId) {
      void startAssignedDiagnostic(assignment);
    }

    setAutoStartHandled(true);
  }, [attemptId, assignmentsQuery.data, autoStartHandled, searchParams, token]);

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-3xl text-white md:text-4xl">Diagnostic Testing Workspace</h1>
        <p className="text-sm text-mist">
          Grade-based diagnostics with break control, telemetry tracking, integrity review for proctors, and parent-ready reports.
        </p>
      </header>

      {introVisible ? (
        <article className="panel rounded-2xl p-5">
          <h2 className="font-display text-xl text-white">Diagnostic Test Intro</h2>
          <p className="mt-1 text-xs text-mist">
            Watch the short intro, then click start to begin your diagnostic session.
          </p>
          <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-black/40">
            <video
              className="w-full"
              controls
              playsInline
              preload="metadata"
            >
              <source src="/media/diagnostic-intro.mp4" type="video/mp4" />
            </video>
          </div>
          <button
            type="button"
            className="mt-4 rounded-full bg-aurora px-5 py-2 text-sm font-semibold text-ink disabled:opacity-50"
            onClick={() => {
              void startDiagnostic();
            }}
            disabled={!token || isAttemptInProgress}
          >
            Start Test
          </button>
        </article>
      ) : null}

      <article className="panel rounded-2xl p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg text-white">Assigned Tests</h2>
          <button
            type="button"
            className="rounded-full border border-white/20 px-3 py-1 text-xs"
            onClick={() => void assignmentsQuery.refetch()}
            disabled={assignmentsQuery.isFetching}
          >
            Refresh
          </button>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {assignmentsQuery.data?.assignments.map((assignment) => (
            <div key={assignment.assignmentId} className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
              <p className="font-semibold text-white">{assignment.label}</p>
              <p className="mt-1 text-mist">
                Grade {assignment.grade} • {assignment.child ? `${assignment.child.firstName} ${assignment.child.lastName}` : "Account"}
              </p>
              <p className="mt-1 text-aurora">Status: {assignment.status}</p>
              <button
                type="button"
                className="mt-2 rounded-full border border-aurora/40 px-3 py-1 text-[11px] text-aurora disabled:opacity-50"
                onClick={() => {
                  void startAssignedDiagnostic(assignment);
                }}
                disabled={!assignment.isStartable || isAttemptInProgress}
              >
                Start Assigned Test
              </button>
            </div>
          ))}
          {!assignmentsQuery.data?.assignments.length ? (
            <p className="text-xs text-mist">No assigned tests yet. Staff can assign tests from the owner workspace.</p>
          ) : null}
        </div>
      </article>

      <article className="panel rounded-2xl p-5">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="space-y-1 text-xs text-mist">
            Grade
            <select
              value={grade}
              onChange={(event) => setGrade(safeNumber(event.target.value))}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
            >
              {gradeOptions.map((item) => (
                <option key={item} value={item}>
                  Grade {item}
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-1 text-xs text-mist">
            <p>Attempt</p>
            <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white">
              {attemptId ?? "Not started"}
            </div>
          </div>
          <div className="space-y-1 text-xs text-mist">
            <p>Time Remaining</p>
            <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white">
              {secondsToClock(remainingSeconds)}
            </div>
          </div>
          <div className="space-y-1 text-xs text-mist">
            <p>Progress</p>
            <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white">{progressText}</div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-full bg-aurora px-4 py-2 text-xs font-semibold text-ink"
            onClick={() => {
              void startDiagnostic();
            }}
            disabled={!token || isAttemptInProgress}
          >
            Start Diagnostic
          </button>
          <button
            type="button"
            className="rounded-full border border-white/20 px-4 py-2 text-xs"
            onClick={() => {
              void saveAnswer(false);
            }}
            disabled={!attemptId || !activeQuestion || isBreak}
          >
            Save Answer
          </button>
          <button
            type="button"
            className="rounded-full border border-aurora/40 px-4 py-2 text-xs text-aurora"
            onClick={() => {
              void takeBreak();
            }}
            disabled={!attemptId || isBreak || breakCount >= maxBreaks || breakSecondsTotal >= maxBreakSeconds || isLastFiveMinutes}
          >
            Take a Break
          </button>
          <button
            type="button"
            className="rounded-full border border-aurora/40 px-4 py-2 text-xs text-aurora"
            onClick={() => {
              void resumeBreak();
            }}
            disabled={!isBreak}
          >
            Resume
          </button>
          <button
            type="button"
            className="rounded-full border border-flare/50 px-4 py-2 text-xs text-flare"
            onClick={() => {
              void submitAttempt();
            }}
            disabled={!attemptId || isBreak || Boolean(studentResult)}
          >
            Submit Attempt
          </button>
          <button
            type="button"
            className="rounded-full border border-white/20 px-4 py-2 text-xs"
            onClick={() => {
              void readResults();
            }}
            disabled={!studentResult}
          >
            Read Results (TTS)
          </button>
        </div>
        <p className="mt-3 text-xs text-mist">
          Breaks: {breakCount}/{maxBreaks} • Max {breakSecondsPerBreak}s each • Total break time: {breakSecondsTotal}s /{" "}
          {maxBreakSeconds}s • Elapsed: {secondsToClock(timerSeconds)}
        </p>
        {isBreak ? (
          <p className="mt-1 text-xs text-aurora">Break active: {secondsToClock(breakSecondsPerBreak - breakSecondsCurrent)} remaining</p>
        ) : null}
        {isLastFiveMinutes && attemptId ? <p className="mt-1 text-xs text-flare">Breaks disabled in final 5 minutes.</p> : null}
      </article>

      {activeQuestion ? (
        <motion.article
          key={activeQuestion.question_id}
          initial={{ opacity: 0, y: 12, scale: 0.995 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="panel rounded-2xl p-5"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-aurora">
            {activeQuestion.subject} • {activeQuestion.type} • Expected {activeQuestion.expected_time_seconds}s
          </p>
          <h2 className="mt-2 font-display text-xl text-white">{activeQuestion.stem}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full border border-aurora/35 px-3 py-1 text-[11px] text-aurora"
              onClick={speakQuestionAndOptions}
            >
              Read Question Out Loud
            </button>
            <button
              type="button"
              className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-mist"
              onClick={speakCurrentAnswer}
            >
              Read My Answer Out Loud
            </button>
          </div>

          {activeQuestion.type === "mcq" ? (
            <div className="mt-4 space-y-2">
              {(activeQuestion.choices ?? []).map((choice) => (
                <label key={choice} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
                  <input
                    type="radio"
                    name={activeQuestion.question_id}
                    value={choice}
                    disabled={isBreak}
                    checked={(answers[activeQuestion.question_id] ?? "") === choice}
                    onChange={(event) => {
                      const value = event.target.value;
                      setAnswers((previous) => ({ ...previous, [activeQuestion.question_id]: value }));
                      if (!firstInteraction[activeQuestion.question_id]) {
                        setFirstInteraction((previous) => ({ ...previous, [activeQuestion.question_id]: true }));
                        void recordEvent({
                          event_type: "first_interaction",
                          attempt_id: attemptId,
                          question_id: activeQuestion.question_id,
                          time: new Date().toISOString()
                        });
                      }
                    }}
                  />
                  {choice}
                </label>
              ))}
            </div>
          ) : (
            <textarea
              className="mt-4 min-h-32 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
              value={answers[activeQuestion.question_id] ?? ""}
              disabled={isBreak}
              onPaste={() => {
                setPasteEvents((previous) => ({ ...previous, [activeQuestion.question_id]: true }));
              }}
              onChange={(event) => {
                setAnswers((previous) => ({ ...previous, [activeQuestion.question_id]: event.target.value }));
                if (!firstInteraction[activeQuestion.question_id]) {
                  setFirstInteraction((previous) => ({ ...previous, [activeQuestion.question_id]: true }));
                  void recordEvent({
                    event_type: "first_interaction",
                    attempt_id: attemptId,
                    question_id: activeQuestion.question_id,
                    time: new Date().toISOString()
                  });
                }
              }}
            />
          )}

          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-xs text-mist">How confident are you in this answer?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {confidenceOptions.map((option) => {
                const selected = confidenceByQuestion[activeQuestion.question_id] === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`rounded-full border px-3 py-1.5 text-xs ${
                      selected ? "border-aurora bg-aurora/20 text-aurora" : "border-white/20 text-mist"
                    }`}
                    onClick={() => {
                      setConfidenceByQuestion((prev) => ({ ...prev, [activeQuestion.question_id]: option.value }));
                    }}
                    disabled={isBreak}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {(activeQuestion.required_tools ?? []).length > 0 ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-mist">Enabled tools for this question</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(activeQuestion.required_tools ?? []).map((tool) => {
                  const isOpen = (openToolsByQuestion[activeQuestion.question_id] ?? []).includes(tool);
                  return (
                    <button
                      key={tool}
                      type="button"
                      className={`rounded-full border px-3 py-1.5 text-xs ${
                        isOpen ? "border-aurora bg-aurora/20 text-aurora" : "border-white/20 text-mist"
                      }`}
                      onClick={() => toggleTool(activeQuestion.question_id, tool)}
                      disabled={isBreak}
                    >
                      {isOpen ? `Hide ${toolLabels[tool]}` : `Open ${toolLabels[tool]}`}
                    </button>
                  );
                })}
              </div>

              {(openToolsByQuestion[activeQuestion.question_id] ?? []).length > 0 ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {(openToolsByQuestion[activeQuestion.question_id] ?? []).map((tool) => (
                    <div key={tool} className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs">
                      <p className="mb-2 font-semibold text-white">{toolLabels[tool]}</p>
                      {tool === "calculator" ? (
                        <div className="space-y-2">
                          <input
                            className="w-full rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs"
                            placeholder="Example: (12 + 8) / 2"
                            value={calculatorExpressionByQuestion[activeQuestion.question_id] ?? ""}
                            onChange={(event) =>
                              setCalculatorExpressionByQuestion((prev) => ({
                                ...prev,
                                [activeQuestion.question_id]: event.target.value
                              }))
                            }
                          />
                          <button
                            type="button"
                            className="rounded-full border border-aurora/40 px-3 py-1 text-[11px] text-aurora"
                            onClick={() => evaluateCalculatorExpression(activeQuestion.question_id)}
                          >
                            Calculate
                          </button>
                          <p className="text-mist">Result: {calculatorResultByQuestion[activeQuestion.question_id] ?? "-"}</p>
                        </div>
                      ) : null}
                      {tool === "scratchpad" ? (
                        <textarea
                          className="min-h-24 w-full rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs"
                          placeholder="Notes"
                          value={scratchpadByQuestion[activeQuestion.question_id] ?? ""}
                          onChange={(event) =>
                            setScratchpadByQuestion((prev) => ({
                              ...prev,
                              [activeQuestion.question_id]: event.target.value
                            }))
                          }
                        />
                      ) : null}
                      {tool === "formula_sheet" ? (
                        <ul className="space-y-1 text-mist">
                          <li>• Percent change = (new - old) / old</li>
                          <li>• Slope m = (y2 - y1) / (x2 - x1)</li>
                          <li>• Break-even = fixed / (price - variable)</li>
                        </ul>
                      ) : null}
                      {tool === "graph_grid" ? (
                        <div
                          className="h-28 rounded-lg border border-white/10"
                          style={{
                            backgroundImage:
                              "linear-gradient(0deg, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
                            backgroundSize: "16px 16px"
                          }}
                          aria-hidden
                        />
                      ) : null}
                      {tool === "ruler" ? <p className="text-mist">Ruler overlay active for measurement questions.</p> : null}
                      {tool === "protractor" ? <p className="text-mist">Protractor overlay active for angle questions.</p> : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="rounded-full border border-white/20 px-3 py-1.5 text-xs"
              onClick={() => {
                void saveAnswer(false);
                if (index > 0) {
                  void showQuestion(index - 1);
                }
              }}
              disabled={index === 0}
            >
              Previous
            </button>
            <button
              type="button"
              className="rounded-full border border-white/20 px-3 py-1.5 text-xs"
              onClick={() => {
                void saveAnswer(false);
                if (index < questions.length - 1) {
                  void showQuestion(index + 1);
                }
              }}
              disabled={index >= questions.length - 1}
            >
              Next
            </button>
          </div>
        </motion.article>
      ) : null}

      {studentResult ? (
        <article className="panel rounded-2xl p-5">
          <h3 className="font-display text-xl text-white">Results Summary</h3>
          <p className="mt-2 text-sm text-mist">Academic Score: {studentResult.final_score}</p>
          <p className="text-sm text-mist">Effort Score: {studentResult.effort_score}</p>
          <p className="text-sm text-mist">Engagement Score: {studentResult.engagement_score}</p>
          {typeof studentResult.confidence_accuracy_score === "number" ? (
            <p className="text-sm text-mist">Confidence Accuracy: {studentResult.confidence_accuracy_score}</p>
          ) : null}
          {typeof studentResult.overconfidence_index === "number" ? (
            <p className="text-sm text-mist">Overconfidence Index: {studentResult.overconfidence_index}</p>
          ) : null}
          <p className="mt-2 text-sm text-mist">Recommendation: {studentResult.recommendation}</p>
        </article>
      ) : null}

      {isAdmin ? (
        <article className="panel rounded-2xl p-5">
          <h3 className="font-display text-xl text-white">Admin / Proctor Controls</h3>
          <p className="mt-1 text-xs text-mist">
            This panel is role-protected and includes integrity data. Student-facing views never show these fields.
          </p>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <input
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
              placeholder="Attempt ID"
              value={adminAttemptId}
              onChange={(event) => setAdminAttemptId(event.target.value)}
            />
            <input
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
              placeholder="Review / lock reason"
              value={adminReason}
              onChange={(event) => setAdminReason(event.target.value)}
            />
            <input
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
              placeholder="Admin key (for answer endpoint)"
              value={adminKey}
              onChange={(event) => setAdminKey(event.target.value)}
            />
          </div>
          <textarea
            className="mt-3 min-h-20 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
            value={adminNotes}
            onChange={(event) => setAdminNotes(event.target.value)}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="rounded-full border border-white/20 px-3 py-1.5 text-xs" onClick={() => void openAdminAttempt()}>
              Open Attempt
            </button>
            <button className="rounded-full border border-white/20 px-3 py-1.5 text-xs" onClick={() => void adminReassign()}>
              Reassign
            </button>
            <button className="rounded-full border border-white/20 px-3 py-1.5 text-xs" onClick={() => void adminMarkReviewed()}>
              Mark Reviewed
            </button>
            <button className="rounded-full border border-red-300/40 px-3 py-1.5 text-xs text-red-200" onClick={() => void adminLockStudent()}>
              Lock Student
            </button>
            <button className="rounded-full border border-white/20 px-3 py-1.5 text-xs" onClick={() => void adminSendParentReport()}>
              Send Parent Report
            </button>
            <button
              className="rounded-full border border-aurora/40 px-3 py-1.5 text-xs text-aurora disabled:opacity-50"
              onClick={() => void adminGetAnswers()}
              disabled={isAttemptInProgress}
            >
              Get Grade Answers
            </button>
          </div>

          {adminView ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
              <p className="text-white">
                Attempt: {adminView.attempt_id} • Student: {adminView.student_name} ({adminView.student_email})
              </p>
              <p className="mt-1 text-mist">
                Final: {adminView.final_score} | Speeding: {adminView.speeding_score} | AI Similarity: {adminView.ai_similarity_score} |
                Integrity: {adminView.integrity_score} ({adminView.integrity_band})
              </p>
              <p className="mt-1 text-mist">Flag reason: {adminView.flag_reason}</p>
              <pre className="mt-2 overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-2 text-[11px] text-mist">
                {JSON.stringify(adminView.flagged_questions, null, 2)}
              </pre>
            </div>
          ) : null}

          {adminAnswers.length > 0 ? (
            <pre className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-2 text-[11px] text-mist">
              {JSON.stringify(adminAnswers, null, 2)}
            </pre>
          ) : null}
        </article>
      ) : null}

      {statusMessage ? <p className="text-sm text-aurora">{statusMessage}</p> : null}
      {errorMessage ? <p className="text-sm text-red-300">{errorMessage}</p> : null}
    </section>
  );
}
