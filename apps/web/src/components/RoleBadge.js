import { jsx as _jsx } from "react/jsx-runtime";
import { roleBadgePalette } from "@projectm/contracts";
export function RoleBadge({ role, compact = false }) {
    const palette = roleBadgePalette[role];
    return (_jsx("span", { className: `inline-flex items-center rounded-full border font-semibold uppercase tracking-[0.12em] ${compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"}`, style: {
            color: palette.color,
            backgroundColor: palette.background,
            borderColor: palette.border
        }, title: palette.label, children: palette.label }));
}
