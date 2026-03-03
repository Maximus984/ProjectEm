"use client";

type Props = {
  seconds: number;
};

function toClock(total: number) {
  const mins = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(total % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
}

export function TimerDisplay({ seconds }: Props) {
  return (
    <div className="panel" data-testid="timer-display">
      <p className="muted">Server Timer</p>
      <h2 style={{ margin: 0 }}>{toClock(Math.max(0, seconds))}</h2>
    </div>
  );
}
