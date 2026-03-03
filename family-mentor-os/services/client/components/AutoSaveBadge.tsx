"use client";

type Props = {
  status: "idle" | "saving" | "saved" | "error";
};

export function AutoSaveBadge({ status }: Props) {
  const label =
    status === "saving"
      ? "Auto-saving..."
      : status === "saved"
        ? "Saved"
        : status === "error"
          ? "Save error"
          : "Idle";

  return <span className="tag">{label}</span>;
}
