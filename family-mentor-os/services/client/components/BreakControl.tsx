"use client";

type Props = {
  used: boolean;
  inBreak: boolean;
  breakRemaining: number;
  onRequestBreak: () => void;
  onResume: () => void;
};

export function BreakControl({ used, inBreak, breakRemaining, onRequestBreak, onResume }: Props) {
  if (inBreak) {
    return (
      <div className="panel" style={{ display: "grid", gap: 8 }}>
        <p className="muted">Break in progress</p>
        <p style={{ margin: 0 }}>Resumes in {breakRemaining}s</p>
        <button className="button" type="button" onClick={onResume}>
          Resume now
        </button>
      </div>
    );
  }

  return (
    <div className="panel" style={{ display: "grid", gap: 8 }}>
      <p className="muted">One break per attempt (5 minutes)</p>
      <button className="button" type="button" disabled={used} onClick={onRequestBreak} data-testid="break-btn">
        {used ? "Break Used" : "Request 5-Minute Break"}
      </button>
    </div>
  );
}
