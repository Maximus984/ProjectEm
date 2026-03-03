import { roleBadgePalette, type UserRole } from "@projectm/contracts";

type RoleBadgeProps = {
  role: UserRole;
  compact?: boolean;
};

export function RoleBadge({ role, compact = false }: RoleBadgeProps) {
  const palette = roleBadgePalette[role];

  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold uppercase tracking-[0.12em] ${
        compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"
      }`}
      style={{
        color: palette.color,
        backgroundColor: palette.background,
        borderColor: palette.border
      }}
      title={palette.label}
    >
      {palette.label}
    </span>
  );
}
