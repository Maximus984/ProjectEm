export type AttemptTimingState = {
  startedAt: Date;
  durationSeconds: number;
  pausedSeconds: number;
  breakStartedAt: Date | null;
  breakEndsAt: Date | null;
};

export function computeRemainingSeconds(state: AttemptTimingState, now: Date): number {
  const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - state.startedAt.getTime()) / 1000));
  const liveBreakSeconds = state.breakStartedAt
    ? Math.max(0, Math.floor((now.getTime() - state.breakStartedAt.getTime()) / 1000))
    : 0;

  const effectiveElapsed = elapsedSeconds - state.pausedSeconds - liveBreakSeconds;
  return Math.max(0, state.durationSeconds - effectiveElapsed);
}

export function isAutoSubmitDue(state: AttemptTimingState, now: Date): boolean {
  if (state.breakStartedAt) {
    return false;
  }
  return computeRemainingSeconds(state, now) <= 0;
}

export function breakCountdownSeconds(breakEndsAt: Date, now: Date): number {
  return Math.max(0, Math.ceil((breakEndsAt.getTime() - now.getTime()) / 1000));
}

export function applyBreakEnd(state: { pausedSeconds: number; breakStartedAt: Date | null }, now: Date): number {
  if (!state.breakStartedAt) {
    return state.pausedSeconds;
  }
  const breakDuration = Math.max(0, Math.floor((now.getTime() - state.breakStartedAt.getTime()) / 1000));
  return state.pausedSeconds + breakDuration;
}

export function shouldFlagSpeeding(metrics: {
  averageSecondsPerQuestion: number;
  thresholdSeconds: number;
  perfectScore: boolean;
  totalDurationSeconds: number;
  rapidRuns: number;
  baselineRatio: number;
}): boolean {
  if (metrics.averageSecondsPerQuestion < metrics.thresholdSeconds) {
    return true;
  }

  if (metrics.perfectScore && metrics.totalDurationSeconds < metrics.thresholdSeconds * 3) {
    return true;
  }

  if (metrics.baselineRatio < 0.55) {
    return true;
  }

  return metrics.rapidRuns >= 5;
}
