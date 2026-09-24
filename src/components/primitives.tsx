/* ===========================================================================
   /components — PRIMITIVES (presentation only)
   Phia card, badge and select. Cards: 1px hairline, soft shadow, 8px radius.
=========================================================================== */
import type { CSSProperties, ReactNode } from "react";
import { T, eyebrow } from "../theme/tokens";

export function Card({
  children,
  className = "",
  style = {},
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={"rounded-lg " + className}
      style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadowSm, ...style }}
    >
      {children}
    </div>
  );
}

export type ChipTone = "good" | "warn" | "blue" | "muted";

/** Phia status badge: tinted fill, 4px radius, Inter bold. */
export function Chip({ tone = "muted", children }: { tone?: ChipTone; children: ReactNode }) {
  const map: Record<ChipTone, { fg: string; bg: string }> = {
    good: { fg: T.good, bg: T.goodBg },
    warn: { fg: T.warn, bg: T.warnBg },
    blue: { fg: T.blue, bg: T.blue100 },
    muted: { fg: T.muted, bg: T.subtle },
  };
  const c = map[tone] || map.muted;
  return (
    <span
      className="inline-block rounded px-2 py-0.5 font-bold"
      style={{ color: c.fg, background: c.bg, fontFamily: T.fontUI, fontSize: 11, lineHeight: "18px" }}
    >
      {children}
    </span>
  );
}

/** Section heading: sentence case, Source Sans Bold, Phia heading colour. */
export const sectionTitle: CSSProperties = { color: T.ink, fontSize: 18, lineHeight: "24px", fontWeight: 700 };

/** Shared field styling for native inputs and selects. */
export const fieldStyle: CSSProperties = {
  border: `1px solid ${T.faint}`,
  background: T.surface,
  color: T.ink,
  borderRadius: 4,
};

export function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span style={eyebrow}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-2 text-sm"
        style={{ ...fieldStyle, minWidth: 120, height: 34 }}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
