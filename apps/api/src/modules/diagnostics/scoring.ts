import type { DiagnosticConfidence, DiagnosticTelemetryEvent } from "@projectm/contracts";
import type { DiagnosticQuestionRecord } from "./question-bank.js";

export type DecryptedDiagnosticEvent = DiagnosticTelemetryEvent & {
  server_received_at: string;
};

export type ComparisonAnswer = {
  attemptId: string;
  studentUserId: string;
  questionId: string;
  answerText: string;
};

type BreakWindow = { start: Date; end: Date };
type QuestionTiming = { questionId: string; seconds: number; ratio: number };

type AnswerSnapshot = {
  questionId: string;
  answer: string;
  pasteEvent: boolean;
  saveCount: number;
  final: boolean;
  confidence?: DiagnosticConfidence;
};

export type FinalizedDiagnostic = {
  finalScore: number;
  subjectBreakdown: Record<string, number>;
  speedingScore: number;
  aiSimilarityScore: number;
  effortScore: number;
  engagementScore: number;
  integrityScore: number;
  integrityBand: "NORMAL" | "LOW" | "MEDIUM" | "HIGH";
  flagReason: string;
  flaggedQuestions: Array<{ question_id: string; flag_reason: string; score: number }>;
  breakSummary: { count: number; total_seconds: number; breaks_exceeded: boolean };
  focusSummary: { hidden_events: number; visible_events: number };
  performanceTrend: {
    speed_shift_index: number;
    style_inconsistency_index: number;
    sudden_performance_jump: boolean;
  };
  confidenceSummary: {
    confidence_accuracy_score: number;
    overconfidence_index: number;
    correct_confident: number;
    correct_guessing: number;
    wrong_confident: number;
    wrong_guessing: number;
  };
  studentSummary: {
    final_score: number;
    subject_breakdown: Record<string, number>;
    effort_score: number;
    engagement_score: number;
    confidence_accuracy_score: number;
    overconfidence_index: number;
    recommendation: string;
  };
  answerStore: Record<string, AnswerSnapshot>;
  evidence: {
    speeding: Array<{ questionId: string; ratio: number; seconds: number }>;
    similarity: Array<{ questionId: string; reason: string; cosine?: number; sourceAttemptId?: string }>;
  };
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toDate(value: string): Date {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function overlapSeconds(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  return end > start ? (end - start) / 1000 : 0;
}

function extractBreakWindows(events: DecryptedDiagnosticEvent[]): BreakWindow[] {
  const windows: BreakWindow[] = [];
  let openStart: Date | null = null;

  for (const event of events) {
    if (event.event_type === "break_start") {
      openStart = toDate(event.start_time);
      continue;
    }
    if (event.event_type === "break_end" && openStart) {
      const end = toDate(event.end_time);
      if (end.getTime() > openStart.getTime()) {
        windows.push({ start: openStart, end });
      }
      openStart = null;
    }
  }

  return windows;
}

function computeQuestionTimings(
  events: DecryptedDiagnosticEvent[],
  questionsById: Map<string, DiagnosticQuestionRecord>,
  submitAt: Date,
  excludeBreaks: boolean
): QuestionTiming[] {
  const shownEvents = events
    .filter((event): event is Extract<DecryptedDiagnosticEvent, { event_type: "question_shown" }> => event.event_type === "question_shown")
    .sort((a, b) => toDate(a.shown_time).getTime() - toDate(b.shown_time).getTime());
  const breakWindows = extractBreakWindows(events);
  const secondsByQuestion = new Map<string, number>();

  for (let i = 0; i < shownEvents.length; i += 1) {
    const current = shownEvents[i];
    const start = toDate(current.shown_time);
    const end = i < shownEvents.length - 1 ? toDate(shownEvents[i + 1].shown_time) : submitAt;
    if (end.getTime() <= start.getTime()) {
      continue;
    }

    let seconds = (end.getTime() - start.getTime()) / 1000;
    if (excludeBreaks) {
      for (const window of breakWindows) {
        seconds -= overlapSeconds(start, end, window.start, window.end);
      }
    }
    seconds = Math.max(0, seconds);

    secondsByQuestion.set(current.question_id, (secondsByQuestion.get(current.question_id) ?? 0) + seconds);
  }

  return Array.from(secondsByQuestion.entries()).map(([questionId, seconds]) => {
    const question = questionsById.get(questionId);
    const expected = question?.expected_time_seconds ?? 60;
    const ratio = expected > 0 ? seconds / expected : 0;
    return { questionId, seconds, ratio };
  });
}

function parseText(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry)).join(" ").trim();
  }
  return "";
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function cosineSimilarity(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (!tokensA.length || !tokensB.length) {
    return 0;
  }

  const freqA = new Map<string, number>();
  const freqB = new Map<string, number>();
  for (const token of tokensA) {
    freqA.set(token, (freqA.get(token) ?? 0) + 1);
  }
  for (const token of tokensB) {
    freqB.set(token, (freqB.get(token) ?? 0) + 1);
  }

  const keys = new Set([...freqA.keys(), ...freqB.keys()]);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const key of keys) {
    const va = freqA.get(key) ?? 0;
    const vb = freqB.get(key) ?? 0;
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }
  if (!normA || !normB) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function vocabularyComplexity(text: string): number {
  const tokens = tokenize(text);
  if (!tokens.length) {
    return 0;
  }
  const unique = new Set(tokens).size;
  const avgWordLength = tokens.reduce((sum, token) => sum + token.length, 0) / tokens.length;
  return (unique / tokens.length) * 0.6 + (avgWordLength / 12) * 0.4;
}

function getIntegrityBand(score: number): "NORMAL" | "LOW" | "MEDIUM" | "HIGH" {
  if (score <= 20) {
    return "NORMAL";
  }
  if (score <= 50) {
    return "LOW";
  }
  if (score <= 80) {
    return "MEDIUM";
  }
  return "HIGH";
}

function buildAnswerStore(events: DecryptedDiagnosticEvent[]): Record<string, AnswerSnapshot> {
  const answerEvents = events.filter(
    (event): event is Extract<DecryptedDiagnosticEvent, { event_type: "answer_save" }> => event.event_type === "answer_save"
  );

  const store: Record<string, AnswerSnapshot> = {};
  for (const event of answerEvents) {
    const current = store[event.question_id] ?? {
      questionId: event.question_id,
      answer: "",
      pasteEvent: false,
      saveCount: 0,
      final: false
    };

    current.answer = parseText(event.answer);
    current.pasteEvent = current.pasteEvent || event.paste_event;
    current.saveCount += 1;
    current.final = current.final || event.is_final;
    current.confidence = event.confidence ?? current.confidence;
    store[event.question_id] = current;
  }
  return store;
}

function evaluateAnswer(question: DiagnosticQuestionRecord, answer: string): number {
  if (!answer) {
    return 0;
  }

  if (question.type === "mcq") {
    return answer.trim().toLowerCase() === question.adminAnswer.trim().toLowerCase() ? 1 : 0;
  }

  if (question.numericAnswer !== undefined) {
    const numeric = Number(answer.replace(/[^0-9.-]/g, ""));
    if (!Number.isNaN(numeric)) {
      const tolerance = question.numericTolerance ?? 0;
      return Math.abs(numeric - question.numericAnswer) <= tolerance ? 1 : 0;
    }
  }

  const words = tokenize(answer);
  const keywordHits = (question.rubricKeywords ?? []).filter((keyword) => answer.toLowerCase().includes(keyword.toLowerCase())).length;
  if (question.type === "short_answer") {
    if (words.length >= 10 && keywordHits >= 2) {
      return 1;
    }
    if (words.length >= 8 || keywordHits >= 1) {
      return 0.7;
    }
    return 0.3;
  }

  if (words.length >= 20 && keywordHits >= 2) {
    return 1;
  }
  if (words.length >= 14 || keywordHits >= 1) {
    return 0.65;
  }
  return 0.35;
}

export function finalizeDiagnosticAttempt(input: {
  attemptStudentUserId: string;
  events: DecryptedDiagnosticEvent[];
  questions: DiagnosticQuestionRecord[];
  priorAttemptSummaries: Array<{
    finalScore: number;
    averageRatio: number;
    vocabularyComplexity: number;
    speedShiftIndex?: number;
  }>;
  comparisonAnswers: ComparisonAnswer[];
  maxBreaksPerAttempt: number;
  maxBreakSecondsPerBreak: number;
  maxTotalBreakSeconds: number;
  focusChangeThreshold: number;
  excludeBreaksFromTiming: boolean;
}): FinalizedDiagnostic {
  const sortedEvents = [...input.events].sort((a, b) => {
    const ta = toDate(a.server_received_at).getTime();
    const tb = toDate(b.server_received_at).getTime();
    return ta - tb;
  });
  const questionById = new Map(input.questions.map((question) => [question.question_id, question]));
  const answerStore = buildAnswerStore(sortedEvents);

  const submitEvent = sortedEvents.find(
    (event): event is Extract<DecryptedDiagnosticEvent, { event_type: "attempt_submit" }> => event.event_type === "attempt_submit"
  );
  const submitAt = submitEvent ? toDate(submitEvent.end_time) : new Date();

  const breakWindows = extractBreakWindows(sortedEvents);
  const breakTotalSeconds = Math.round(
    breakWindows.reduce((sum, window) => sum + (window.end.getTime() - window.start.getTime()) / 1000, 0)
  );
  const breakCount = breakWindows.length;
  const longestBreakSeconds = breakWindows.reduce((max, window) => {
    const seconds = (window.end.getTime() - window.start.getTime()) / 1000;
    return Math.max(max, seconds);
  }, 0);
  const breaksExceeded =
    breakCount > input.maxBreaksPerAttempt ||
    breakTotalSeconds > input.maxTotalBreakSeconds ||
    longestBreakSeconds > input.maxBreakSecondsPerBreak;

  const focusHidden = sortedEvents.filter(
    (event): event is Extract<DecryptedDiagnosticEvent, { event_type: "focus_change" }> =>
      event.event_type === "focus_change" && event.event === "hidden"
  ).length;
  const focusVisible = sortedEvents.filter(
    (event): event is Extract<DecryptedDiagnosticEvent, { event_type: "focus_change" }> =>
      event.event_type === "focus_change" && event.event === "visible"
  ).length;

  const timings = computeQuestionTimings(sortedEvents, questionById, submitAt, input.excludeBreaksFromTiming);
  const ratioByQuestion = new Map(timings.map((item) => [item.questionId, item.ratio]));
  const secondsByQuestion = new Map(timings.map((item) => [item.questionId, item.seconds]));

  let finalScoreRaw = 0;
  const subjectAccumulator = new Map<string, { sum: number; count: number }>();
  for (const question of input.questions) {
    const answer = answerStore[question.question_id]?.answer ?? "";
    const value = evaluateAnswer(question, answer);
    finalScoreRaw += value;
    const current = subjectAccumulator.get(question.subject) ?? { sum: 0, count: 0 };
    current.sum += value;
    current.count += 1;
    subjectAccumulator.set(question.subject, current);
  }
  const finalScore = Math.round((finalScoreRaw / input.questions.length) * 100);

  const subjectBreakdown: Record<string, number> = {};
  for (const [subject, item] of subjectAccumulator.entries()) {
    subjectBreakdown[subject] = Math.round((item.sum / item.count) * 100);
  }

  let speedingScore = 0;
  const speedingEvidence: Array<{ questionId: string; ratio: number; seconds: number }> = [];
  const flags: Array<{ question_id: string; flag_reason: string; score: number }> = [];

  const orderedRatios = input.questions.map((question) => ratioByQuestion.get(question.question_id) ?? 0);
  let consecutiveFast = 0;
  let maxConsecutiveFast = 0;
  let belowMinCount = 0;

  for (const question of input.questions) {
    const ratio = ratioByQuestion.get(question.question_id) ?? 0;
    const seconds = secondsByQuestion.get(question.question_id) ?? 0;
    if (ratio < 0.1) {
      speedingScore += 5;
      consecutiveFast += 1;
      belowMinCount += 1;
      flags.push({ question_id: question.question_id, flag_reason: "very_fast_response", score: 5 });
      speedingEvidence.push({ questionId: question.question_id, ratio, seconds });
    } else if (ratio < 0.3) {
      speedingScore += 2;
      consecutiveFast += 1;
      belowMinCount += 1;
      flags.push({ question_id: question.question_id, flag_reason: "fast_response", score: 2 });
      speedingEvidence.push({ questionId: question.question_id, ratio, seconds });
    } else {
      consecutiveFast = 0;
    }
    maxConsecutiveFast = Math.max(maxConsecutiveFast, consecutiveFast);
  }

  if (maxConsecutiveFast >= 5) {
    speedingScore += 15;
    flags.push({ question_id: "attempt", flag_reason: "consecutive_fast_answers", score: 15 });
  }

  if (belowMinCount / input.questions.length > 0.4) {
    speedingScore += 20;
    flags.push({ question_id: "attempt", flag_reason: "high_percent_below_min_time", score: 20 });
  }

  const hasPaste = Object.values(answerStore).some((answer) => answer.pasteEvent);
  if (hasPaste) {
    speedingScore += 25;
    flags.push({ question_id: "attempt", flag_reason: "paste_event_detected", score: 25 });
  }

  if (focusHidden > input.focusChangeThreshold) {
    speedingScore += 10;
    flags.push({ question_id: "attempt", flag_reason: "excessive_focus_changes", score: 10 });
  }

  if (longestBreakSeconds > input.maxBreakSecondsPerBreak) {
    flags.push({ question_id: "attempt", flag_reason: "break_exceeds_per_break_limit", score: 5 });
  }

  if (breakCount > input.maxBreaksPerAttempt || breakTotalSeconds > input.maxTotalBreakSeconds) {
    flags.push({ question_id: "attempt", flag_reason: "break_exceeds_attempt_limit", score: 5 });
  }

  speedingScore = clamp(speedingScore, 0, 100);

  let aiSimilarityScore = 0;
  const similarityEvidence: Array<{ questionId: string; reason: string; cosine?: number; sourceAttemptId?: string }> = [];
  const currentTextAnswers = input.questions
    .filter((question) => question.type !== "mcq")
    .map((question) => ({
      questionId: question.question_id,
      text: answerStore[question.question_id]?.answer ?? "",
      pasteEvent: answerStore[question.question_id]?.pasteEvent ?? false
    }))
    .filter((item) => item.text.length > 0);

  for (const answer of currentTextAnswers) {
    const normalized = answer.text.trim().toLowerCase();
    if (!normalized) {
      continue;
    }

    let bestCosine = 0;
    let bestAttemptId: string | undefined;
    let exactMatch = false;

    for (const comparison of input.comparisonAnswers) {
      if (comparison.questionId !== answer.questionId) {
        continue;
      }
      const comparisonNorm = comparison.answerText.trim().toLowerCase();
      if (!comparisonNorm) {
        continue;
      }
      if (comparisonNorm === normalized) {
        exactMatch = true;
        bestAttemptId = comparison.attemptId;
        break;
      }
      const cosine = cosineSimilarity(normalized, comparisonNorm);
      if (cosine > bestCosine) {
        bestCosine = cosine;
        bestAttemptId = comparison.attemptId;
      }
    }

    if (exactMatch) {
      aiSimilarityScore += 30;
      similarityEvidence.push({
        questionId: answer.questionId,
        reason: "exact_text_match",
        sourceAttemptId: bestAttemptId
      });
    } else if (bestCosine >= 0.95) {
      aiSimilarityScore += 40;
      similarityEvidence.push({
        questionId: answer.questionId,
        reason: "cosine_gte_0_95",
        cosine: Number(bestCosine.toFixed(4)),
        sourceAttemptId: bestAttemptId
      });
    } else if (bestCosine >= 0.92) {
      aiSimilarityScore += 25;
      similarityEvidence.push({
        questionId: answer.questionId,
        reason: "cosine_between_0_92_0_95",
        cosine: Number(bestCosine.toFixed(4)),
        sourceAttemptId: bestAttemptId
      });
    }

    if (answer.pasteEvent) {
      aiSimilarityScore += 30;
      similarityEvidence.push({
        questionId: answer.questionId,
        reason: "paste_event_on_text_answer"
      });
    }
  }

  const currentComplexity =
    currentTextAnswers.length > 0
      ? currentTextAnswers.reduce((sum, item) => sum + vocabularyComplexity(item.text), 0) / currentTextAnswers.length
      : 0;
  const previousComplexity =
    input.priorAttemptSummaries.length > 0
      ? input.priorAttemptSummaries.reduce((sum, item) => sum + item.vocabularyComplexity, 0) /
        input.priorAttemptSummaries.length
      : 0;

  if (previousComplexity > 0 && currentComplexity - previousComplexity >= 0.25) {
    aiSimilarityScore += 10;
    similarityEvidence.push({
      questionId: "attempt",
      reason: "sudden_vocabulary_complexity_jump"
    });
  }

  aiSimilarityScore = clamp(aiSimilarityScore, 0, 100);

  let effortScore = 50;
  const longResponses = currentTextAnswers.filter((item) => tokenize(item.text).length > 10).length;
  if (longResponses >= Math.ceil(currentTextAnswers.length * 0.5) && currentTextAnswers.length > 0) {
    effortScore += 15;
  }

  const reasonableRatioCount = orderedRatios.filter((ratio) => ratio >= 0.6 && ratio <= 1.8).length;
  if (reasonableRatioCount >= Math.ceil(input.questions.length * 0.55)) {
    effortScore += 10;
  }

  const revisions = Object.values(answerStore).filter((answer) => answer.saveCount > 1).length;
  if (revisions > 0) {
    effortScore += Math.min(10, revisions * 2);
  }

  const shortTextCount = currentTextAnswers.filter((item) => tokenize(item.text).length < 4).length;
  if (shortTextCount > 0) {
    effortScore -= Math.min(15, shortTextCount * 3);
  }

  const mcqAnswers = input.questions
    .filter((question) => question.type === "mcq")
    .map((question) => answerStore[question.question_id]?.answer ?? "");
  let longestRun = 1;
  let currentRun = 1;
  for (let i = 1; i < mcqAnswers.length; i += 1) {
    if (mcqAnswers[i] && mcqAnswers[i] === mcqAnswers[i - 1]) {
      currentRun += 1;
      longestRun = Math.max(longestRun, currentRun);
    } else {
      currentRun = 1;
    }
  }
  if (longestRun >= 5) {
    effortScore -= 10;
  }

  if (belowMinCount / input.questions.length > 0.4) {
    effortScore -= 10;
  }
  effortScore = clamp(Math.round(effortScore), 0, 100);

  const focusStability = clamp(100 - focusHidden * 8, 0, 100);
  const breakDiscipline = breaksExceeded
    ? 30
    : clamp(100 - breakCount * 15 - Math.round(breakTotalSeconds / 30), 0, 100);

  const meanRatio =
    orderedRatios.length > 0 ? orderedRatios.reduce((sum, ratio) => sum + ratio, 0) / orderedRatios.length : 0;
  const variance =
    orderedRatios.length > 0
      ? orderedRatios.reduce((sum, ratio) => sum + (ratio - meanRatio) ** 2, 0) / orderedRatios.length
      : 0;
  const consistencyScore = clamp(100 - Math.round(variance * 60), 0, 100);

  const engagementScore = clamp(
    Math.round(0.45 * effortScore + 0.25 * focusStability + 0.15 * breakDiscipline + 0.15 * consistencyScore),
    0,
    100
  );

  const integrityScore = clamp(Math.round(0.6 * aiSimilarityScore + 0.4 * speedingScore), 0, 100);
  const integrityBand = getIntegrityBand(integrityScore);

  const prior = input.priorAttemptSummaries[input.priorAttemptSummaries.length - 1];
  const previousFinal = prior?.finalScore ?? finalScore;
  const previousRatio = prior?.averageRatio ?? meanRatio;
  const speedShiftIndex = previousRatio > 0 ? Number(((meanRatio - previousRatio) / previousRatio).toFixed(3)) : 0;
  const styleInconsistencyIndex =
    previousComplexity > 0 ? Number(Math.abs(currentComplexity - previousComplexity).toFixed(3)) : 0;
  const suddenPerformanceJump = finalScore - previousFinal >= 20 && meanRatio < previousRatio * 0.8;

  const recommendation =
    finalScore >= 85
      ? "Advance to higher-complexity project tasks."
      : finalScore >= 70
        ? "Continue current pathway with targeted practice."
        : "Schedule guided review sessions and scaffolded assignments.";

  let correctConfident = 0;
  let correctGuessing = 0;
  let wrongConfident = 0;
  let wrongGuessing = 0;
  let confidenceAligned = 0;
  let confidenceCaptured = 0;

  for (const question of input.questions) {
    const snapshot = answerStore[question.question_id];
    if (!snapshot?.confidence) {
      continue;
    }
    confidenceCaptured += 1;
    const score = evaluateAnswer(question, snapshot.answer);
    const isCorrect = score >= 0.7;

    if (snapshot.confidence === "very_confident") {
      if (isCorrect) {
        correctConfident += 1;
        confidenceAligned += 1;
      } else {
        wrongConfident += 1;
      }
      continue;
    }

    if (snapshot.confidence === "guessing") {
      if (isCorrect) {
        correctGuessing += 1;
      } else {
        wrongGuessing += 1;
        confidenceAligned += 1;
      }
      continue;
    }

    if (isCorrect) {
      confidenceAligned += 1;
    }
  }

  const confidenceAccuracyScore =
    confidenceCaptured > 0 ? Math.round((confidenceAligned / confidenceCaptured) * 100) : 0;
  const overconfidenceIndex = Math.round((wrongConfident / input.questions.length) * 100);

  const flagReason =
    integrityBand === "NORMAL"
      ? "No action required"
      : integrityBand === "LOW"
        ? "Flagged for review"
        : integrityBand === "MEDIUM"
          ? "Manual review recommended"
          : "Require proctor/admin review";

  return {
    finalScore,
    subjectBreakdown,
    speedingScore,
    aiSimilarityScore,
    effortScore,
    engagementScore,
    integrityScore,
    integrityBand,
    flagReason,
    flaggedQuestions: flags,
    breakSummary: {
      count: breakCount,
      total_seconds: breakTotalSeconds,
      breaks_exceeded: breaksExceeded
    },
    focusSummary: {
      hidden_events: focusHidden,
      visible_events: focusVisible
    },
    performanceTrend: {
      speed_shift_index: speedShiftIndex,
      style_inconsistency_index: styleInconsistencyIndex,
      sudden_performance_jump: suddenPerformanceJump
    },
    confidenceSummary: {
      confidence_accuracy_score: confidenceAccuracyScore,
      overconfidence_index: overconfidenceIndex,
      correct_confident: correctConfident,
      correct_guessing: correctGuessing,
      wrong_confident: wrongConfident,
      wrong_guessing: wrongGuessing
    },
    studentSummary: {
      final_score: finalScore,
      subject_breakdown: subjectBreakdown,
      effort_score: effortScore,
      engagement_score: engagementScore,
      confidence_accuracy_score: confidenceAccuracyScore,
      overconfidence_index: overconfidenceIndex,
      recommendation
    },
    answerStore,
    evidence: {
      speeding: speedingEvidence,
      similarity: similarityEvidence
    }
  };
}
