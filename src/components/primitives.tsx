/* ===========================================================================
   /components — PRIMITIVES (presentation only)
=========================================================================== */
import type { CSSProperties, ReactNode } from "react";
import { T } from "../theme/tokens";

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
      style={{ background: T.surface, border: `1px solid ${T.border}`, ...style }}
    >
      {children}
    </div>
  );
}

export type ChipTone = "good" | "warn" | "blue" | "muted";

export function Chip({ tone = "muted", children }: { tone?: ChipTone; children: ReactNode }) {
  const map: Record<ChipTone, string> = {
    good: T.good,
    warn: T.warn,
    blue: T.blue,
    muted: T.muted,
  };
  const c = map[tone] || T.muted;
  return (
    <span
      className="inline-block rounded px-2 py-1 text-xs font-semibold"
      style={{ color: c, background: c + "14", letterSpacing: "0.02em" }}
    >
      {children}
    </span>
  );
}

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
      <span
        className="text-xs font-bold uppercase"
        style={{ color: T.muted, letterSpacing: "0.05em" }}
      >
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded px-2 py-1 text-sm"
        style={{ border: `1px solid ${T.border}`, background: T.surface, color: T.ink, minWidth: 120 }}
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
