import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { isAdminRole } from "@projectm/contracts";
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth-store";
const gradeOptions = [7, 8, 9, 10, 11, 12];
const maxBreaks = 2;
const maxBreakSeconds = 600;
function secondsToClock(value) {
    const minutes = Math.floor(value / 60)
        .toString()
        .padStart(2, "0");
    const seconds = Math.floor(value % 60)
        .toString()
        .padStart(2, "0");
    return `${minutes}:${seconds}`;
}
function safeNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}
export function DiagnosticPage() {
    const token = useAuthStore((state) => state.accessToken);
    const role = useAuthStore((state) => state.role);
    const email = useAuthStore((state) => state.email);
    const isAdmin = Boolean(role && isAdminRole(role));
    const [grade, setGrade] = useState(7);
    const [attemptId, setAttemptId] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [index, setIndex] = useState(0);
    const [answers, setAnswers] = useState({});
    const [firstInteraction, setFirstInteraction] = useState({});
    const [pasteEvents, setPasteEvents] = useState({});
    const [timerSeconds, setTimerSeconds] = useState(0);
    const [isBreak, setIsBreak] = useState(false);
    const [breakStartTime, setBreakStartTime] = useState(null);
    const [breakCount, setBreakCount] = useState(0);
    const [breakSecondsTotal, setBreakSecondsTotal] = useState(0);
    const [statusMessage, setStatusMessage] = useState(null);
    const [errorMessage, setErrorMessage] = useState(null);
    const [studentResult, setStudentResult] = useState(null);
    const [adminKey, setAdminKey] = useState("");
    const [adminAttemptId, setAdminAttemptId] = useState("");
    const [adminReason, setAdminReason] = useState("Manual review requested.");
    const [adminNotes, setAdminNotes] = useState("Reviewed by proctor.");
    const [adminView, setAdminView] = useState(null);
    const [adminAnswers, setAdminAnswers] = useState([]);
    const activeQuestion = questions[index] ?? null;
    const progressText = useMemo(() => (questions.length ? `${index + 1} / ${questions.length}` : "0 / 0"), [index, questions.length]);
    async function runtimeRequest(payload) {
        return api("/diagnostic/runtime", {
            method: "POST",
            token: token ?? undefined,
            body: JSON.stringify(payload)
        });
    }
    async function recordEvent(event, explicitAttemptId) {
        const eventAttemptId = explicitAttemptId ?? attemptId;
        if (!eventAttemptId || !token) {
            return;
        }
        await runtimeRequest({
            action: "record_event",
            event: {
                ...event,
                attempt_id: eventAttemptId
            }
        });
    }
    async function showQuestion(nextIndex) {
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
    async function startDiagnostic() {
        setErrorMessage(null);
        setStatusMessage(null);
        setStudentResult(null);
        if (!token) {
            setErrorMessage("You must be logged in to start diagnostics.");
            return;
        }
        try {
            const generatedAttemptId = crypto.randomUUID();
            const questionPayload = await runtimeRequest({
                action: "get_questions",
                grade
            });
            setQuestions(questionPayload.questions);
            setAttemptId(generatedAttemptId);
            setAnswers({});
            setFirstInteraction({});
            setPasteEvents({});
            setTimerSeconds(0);
            setIsBreak(false);
            setBreakStartTime(null);
            setBreakCount(0);
            setBreakSecondsTotal(0);
            await recordEvent({
                event_type: "attempt_start",
                student_id: email ?? "student",
                grade,
                test_id: "projectm_diagnostic_v1",
                start_time: new Date().toISOString(),
                userAgent: navigator.userAgent
            }, generatedAttemptId);
            if (questionPayload.questions.length > 0) {
                await recordEvent({
                    event_type: "question_shown",
                    question_id: questionPayload.questions[0].question_id,
                    shown_time: new Date().toISOString()
                }, generatedAttemptId);
            }
            setStatusMessage("Diagnostic started.");
        }
        catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Unable to start diagnostic.");
        }
    }
    async function saveAnswer(isFinal) {
        if (!attemptId || !activeQuestion || isBreak) {
            return;
        }
        const answer = answers[activeQuestion.question_id] ?? "";
        await recordEvent({
            event_type: "answer_save",
            attempt_id: attemptId,
            question_id: activeQuestion.question_id,
            answer,
            time: new Date().toISOString(),
            is_final: isFinal,
            paste_event: pasteEvents[activeQuestion.question_id] ?? false
        });
    }
    async function submitAttempt() {
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
            const result = await runtimeRequest({
                action: "submit_attempt",
                attempt_id: attemptId
            });
            setStudentResult(result);
            setStatusMessage("Attempt submitted.");
            if (isAdmin) {
                setAdminAttemptId(result.attempt_id);
            }
        }
        catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Submit failed.");
        }
    }
    async function takeBreak() {
        if (!attemptId || isBreak) {
            return;
        }
        if (breakCount >= maxBreaks || breakSecondsTotal >= maxBreakSeconds) {
            setErrorMessage("Break limit reached.");
            return;
        }
        setIsBreak(true);
        setBreakCount((value) => value + 1);
        setBreakStartTime(Date.now());
        await recordEvent({
            event_type: "break_start",
            attempt_id: attemptId,
            start_time: new Date().toISOString()
        });
    }
    async function resumeBreak() {
        if (!attemptId || !isBreak) {
            return;
        }
        const now = Date.now();
        const delta = breakStartTime ? Math.max(0, Math.round((now - breakStartTime) / 1000)) : 0;
        setBreakSecondsTotal((value) => value + delta);
        setBreakStartTime(null);
        setIsBreak(false);
        await recordEvent({
            event_type: "break_end",
            attempt_id: attemptId,
            end_time: new Date().toISOString()
        });
    }
    async function readResults() {
        if (!attemptId) {
            return;
        }
        try {
            const payload = await api(`/diagnostic/attempts/${attemptId}/results-summary`, {
                method: "GET",
                token: token ?? undefined
            });
            const utterance = new SpeechSynthesisUtterance(payload.summary_text);
            utterance.lang = "en-US";
            utterance.rate = 1;
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utterance);
        }
        catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Unable to read results.");
        }
    }
    async function openAdminAttempt() {
        if (!adminAttemptId.trim()) {
            setErrorMessage("Enter attempt id.");
            return;
        }
        try {
            const payload = await api(`/diagnostic/admin/attempts/${adminAttemptId.trim()}`, {
                method: "GET",
                token: token ?? undefined
            });
            setAdminView(payload);
            setStatusMessage("Loaded proctor attempt view.");
        }
        catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Unable to load proctor view.");
        }
    }
    async function adminReassign() {
        if (!adminAttemptId.trim()) {
            return;
        }
        try {
            const payload = await api(`/diagnostic/admin/attempts/${adminAttemptId.trim()}/reassign`, {
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
        }
        catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Reassign failed.");
        }
    }
    async function adminMarkReviewed() {
        if (!adminAttemptId.trim()) {
            return;
        }
        try {
            await api(`/diagnostic/admin/attempts/${adminAttemptId.trim()}/mark_reviewed`, {
                method: "POST",
                token: token ?? undefined,
                body: JSON.stringify({
                    verdict: "valid_attempt",
                    notes: adminNotes
                })
            });
            setStatusMessage("Marked reviewed.");
        }
        catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Mark reviewed failed.");
        }
    }
    async function adminLockStudent() {
        if (!adminAttemptId.trim()) {
            return;
        }
        try {
            await api(`/diagnostic/admin/attempts/${adminAttemptId.trim()}/lock_student`, {
                method: "POST",
                token: token ?? undefined,
                body: JSON.stringify({
                    reason: adminReason
                })
            });
            setStatusMessage("Student locked for diagnostics.");
        }
        catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Lock student failed.");
        }
    }
    async function adminSendParentReport() {
        if (!adminAttemptId.trim()) {
            return;
        }
        try {
            await api(`/diagnostic/admin/attempts/${adminAttemptId.trim()}/send_parent_report`, {
                method: "POST",
                token: token ?? undefined,
                body: JSON.stringify({
                    deliveryChannel: "EMAIL"
                })
            });
            setStatusMessage("Parent report queued.");
        }
        catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Parent report failed.");
        }
    }
    async function adminGetAnswers() {
        if (!adminKey || !isAdmin) {
            setErrorMessage("Admin key required.");
            return;
        }
        try {
            const payload = await runtimeRequest({
                action: "get_answers",
                grade,
                auth: adminKey
            });
            setAdminAnswers(payload.answers);
            setStatusMessage("Answer key loaded.");
        }
        catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Unable to load answer key.");
        }
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
    return (_jsxs("section", { className: "space-y-6", children: [_jsxs("header", { className: "space-y-2", children: [_jsx("h1", { className: "font-display text-3xl text-white md:text-4xl", children: "Diagnostic Testing Workspace" }), _jsx("p", { className: "text-sm text-mist", children: "Grade-based diagnostics with break control, telemetry tracking, integrity review for proctors, and parent-ready reports." })] }), _jsxs("article", { className: "panel rounded-2xl p-5", children: [_jsxs("div", { className: "grid gap-3 md:grid-cols-4", children: [_jsxs("label", { className: "space-y-1 text-xs text-mist", children: ["Grade", _jsx("select", { value: grade, onChange: (event) => setGrade(safeNumber(event.target.value)), className: "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", children: gradeOptions.map((item) => (_jsxs("option", { value: item, children: ["Grade ", item] }, item))) })] }), _jsxs("div", { className: "space-y-1 text-xs text-mist", children: [_jsx("p", { children: "Attempt" }), _jsx("div", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white", children: attemptId ?? "Not started" })] }), _jsxs("div", { className: "space-y-1 text-xs text-mist", children: [_jsx("p", { children: "Timer" }), _jsx("div", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white", children: secondsToClock(timerSeconds) })] }), _jsxs("div", { className: "space-y-1 text-xs text-mist", children: [_jsx("p", { children: "Progress" }), _jsx("div", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white", children: progressText })] })] }), _jsxs("div", { className: "mt-4 flex flex-wrap gap-2", children: [_jsx("button", { type: "button", className: "rounded-full bg-aurora px-4 py-2 text-xs font-semibold text-ink", onClick: () => {
                                    void startDiagnostic();
                                }, disabled: !token || Boolean(attemptId && !studentResult), children: "Start Diagnostic" }), _jsx("button", { type: "button", className: "rounded-full border border-white/20 px-4 py-2 text-xs", onClick: () => {
                                    void saveAnswer(false);
                                }, disabled: !attemptId || !activeQuestion || isBreak, children: "Save Answer" }), _jsx("button", { type: "button", className: "rounded-full border border-aurora/40 px-4 py-2 text-xs text-aurora", onClick: () => {
                                    void takeBreak();
                                }, disabled: !attemptId || isBreak || breakCount >= maxBreaks || breakSecondsTotal >= maxBreakSeconds, children: "Take a Break" }), _jsx("button", { type: "button", className: "rounded-full border border-aurora/40 px-4 py-2 text-xs text-aurora", onClick: () => {
                                    void resumeBreak();
                                }, disabled: !isBreak, children: "Resume" }), _jsx("button", { type: "button", className: "rounded-full border border-flare/50 px-4 py-2 text-xs text-flare", onClick: () => {
                                    void submitAttempt();
                                }, disabled: !attemptId || isBreak || Boolean(studentResult), children: "Submit Attempt" }), _jsx("button", { type: "button", className: "rounded-full border border-white/20 px-4 py-2 text-xs", onClick: () => {
                                    void readResults();
                                }, disabled: !studentResult, children: "Read Results (TTS)" })] }), _jsxs("p", { className: "mt-3 text-xs text-mist", children: ["Breaks: ", breakCount, "/", maxBreaks, " \u2022 Total break time: ", breakSecondsTotal, "s / ", maxBreakSeconds, "s"] })] }), activeQuestion ? (_jsxs("article", { className: "panel rounded-2xl p-5", children: [_jsxs("p", { className: "text-xs uppercase tracking-[0.2em] text-aurora", children: [activeQuestion.subject, " \u2022 ", activeQuestion.type, " \u2022 Expected ", activeQuestion.expected_time_seconds, "s"] }), _jsx("h2", { className: "mt-2 font-display text-xl text-white", children: activeQuestion.stem }), activeQuestion.type === "mcq" ? (_jsx("div", { className: "mt-4 space-y-2", children: (activeQuestion.choices ?? []).map((choice) => (_jsxs("label", { className: "flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm", children: [_jsx("input", { type: "radio", name: activeQuestion.question_id, value: choice, disabled: isBreak, checked: (answers[activeQuestion.question_id] ?? "") === choice, onChange: (event) => {
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
                                    } }), choice] }, choice))) })) : (_jsx("textarea", { className: "mt-4 min-h-32 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", value: answers[activeQuestion.question_id] ?? "", disabled: isBreak, onPaste: () => {
                            setPasteEvents((previous) => ({ ...previous, [activeQuestion.question_id]: true }));
                        }, onChange: (event) => {
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
                        } })), _jsxs("div", { className: "mt-4 flex gap-2", children: [_jsx("button", { type: "button", className: "rounded-full border border-white/20 px-3 py-1.5 text-xs", onClick: () => {
                                    void saveAnswer(false);
                                    if (index > 0) {
                                        void showQuestion(index - 1);
                                    }
                                }, disabled: index === 0, children: "Previous" }), _jsx("button", { type: "button", className: "rounded-full border border-white/20 px-3 py-1.5 text-xs", onClick: () => {
                                    void saveAnswer(false);
                                    if (index < questions.length - 1) {
                                        void showQuestion(index + 1);
                                    }
                                }, disabled: index >= questions.length - 1, children: "Next" })] })] })) : null, studentResult ? (_jsxs("article", { className: "panel rounded-2xl p-5", children: [_jsx("h3", { className: "font-display text-xl text-white", children: "Results Summary" }), _jsxs("p", { className: "mt-2 text-sm text-mist", children: ["Academic Score: ", studentResult.final_score] }), _jsxs("p", { className: "text-sm text-mist", children: ["Effort Score: ", studentResult.effort_score] }), _jsxs("p", { className: "text-sm text-mist", children: ["Engagement Score: ", studentResult.engagement_score] }), _jsxs("p", { className: "mt-2 text-sm text-mist", children: ["Recommendation: ", studentResult.recommendation] })] })) : null, isAdmin ? (_jsxs("article", { className: "panel rounded-2xl p-5", children: [_jsx("h3", { className: "font-display text-xl text-white", children: "Admin / Proctor Controls" }), _jsx("p", { className: "mt-1 text-xs text-mist", children: "This panel is role-protected and includes integrity data. Student-facing views never show these fields." }), _jsxs("div", { className: "mt-3 grid gap-3 md:grid-cols-3", children: [_jsx("input", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", placeholder: "Attempt ID", value: adminAttemptId, onChange: (event) => setAdminAttemptId(event.target.value) }), _jsx("input", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", placeholder: "Review / lock reason", value: adminReason, onChange: (event) => setAdminReason(event.target.value) }), _jsx("input", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", placeholder: "Admin key (for answer endpoint)", value: adminKey, onChange: (event) => setAdminKey(event.target.value) })] }), _jsx("textarea", { className: "mt-3 min-h-20 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", value: adminNotes, onChange: (event) => setAdminNotes(event.target.value) }), _jsxs("div", { className: "mt-3 flex flex-wrap gap-2", children: [_jsx("button", { className: "rounded-full border border-white/20 px-3 py-1.5 text-xs", onClick: () => void openAdminAttempt(), children: "Open Attempt" }), _jsx("button", { className: "rounded-full border border-white/20 px-3 py-1.5 text-xs", onClick: () => void adminReassign(), children: "Reassign" }), _jsx("button", { className: "rounded-full border border-white/20 px-3 py-1.5 text-xs", onClick: () => void adminMarkReviewed(), children: "Mark Reviewed" }), _jsx("button", { className: "rounded-full border border-red-300/40 px-3 py-1.5 text-xs text-red-200", onClick: () => void adminLockStudent(), children: "Lock Student" }), _jsx("button", { className: "rounded-full border border-white/20 px-3 py-1.5 text-xs", onClick: () => void adminSendParentReport(), children: "Send Parent Report" }), _jsx("button", { className: "rounded-full border border-aurora/40 px-3 py-1.5 text-xs text-aurora", onClick: () => void adminGetAnswers(), children: "Get Grade Answers" })] }), adminView ? (_jsxs("div", { className: "mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-xs", children: [_jsxs("p", { className: "text-white", children: ["Attempt: ", adminView.attempt_id, " \u2022 Student: ", adminView.student_name, " (", adminView.student_email, ")"] }), _jsxs("p", { className: "mt-1 text-mist", children: ["Final: ", adminView.final_score, " | Speeding: ", adminView.speeding_score, " | AI Similarity: ", adminView.ai_similarity_score, " | Integrity: ", adminView.integrity_score, " (", adminView.integrity_band, ")"] }), _jsxs("p", { className: "mt-1 text-mist", children: ["Flag reason: ", adminView.flag_reason] }), _jsx("pre", { className: "mt-2 overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-2 text-[11px] text-mist", children: JSON.stringify(adminView.flagged_questions, null, 2) })] })) : null, adminAnswers.length > 0 ? (_jsx("pre", { className: "mt-4 overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-2 text-[11px] text-mist", children: JSON.stringify(adminAnswers, null, 2) })) : null] })) : null, statusMessage ? _jsx("p", { className: "text-sm text-aurora", children: statusMessage }) : null, errorMessage ? _jsx("p", { className: "text-sm text-red-300", children: errorMessage }) : null] }));
}
