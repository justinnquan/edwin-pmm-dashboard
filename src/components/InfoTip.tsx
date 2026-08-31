/* ===========================================================================
   /components — INFO TOOLTIP (accessible)
   An ⓘ affordance that reveals a KPI's definition, calculation, and
   limitation. Opens on hover, keyboard focus, or click; closes on blur / Esc.
=========================================================================== */
import { useId, useState } from "react";
import { T } from "../theme/tokens";

export interface KpiInfo {
  definition: string;
  calculation: string;
  limitation: string;
}

export function InfoTip({ label, info, side = "left" }: { label: string; info: KpiInfo; side?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const anchor = side === "right" ? { right: 0 } : { left: 0 };

  return (
    <span className="relative inline-flex" style={{ lineHeight: 0 }}>
      <button
        type="button"
        aria-label={`About ${label}`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        style={{
          width: 15,
          height: 15,
          borderRadius: "50%",
          border: `1px solid ${T.border}`,
          background: T.surface,
          color: T.muted,
          fontSize: 10,
          fontWeight: 800,
          fontStyle: "italic",
          cursor: "help",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Georgia, serif",
        }}
      >
        i
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute z-50 rounded-md p-3 text-xs"
          style={{
            top: "calc(100% + 6px)",
            ...anchor,
            width: 260,
            background: T.surface,
            border: `1px solid ${T.border}`,
            boxShadow: "0 6px 20px rgba(0,0,0,.12)",
            lineHeight: 1.5,
            fontStyle: "normal",
            fontWeight: 400,
            letterSpacing: "normal",
            textTransform: "none",
            cursor: "default",
          }}
        >
          {(
            [
              ["Definition", info.definition],
              ["Calculation", info.calculation],
              ["Limitation", info.limitation],
            ] as const
          ).map(([k, v], i) => (
            <span key={k} className="block" style={{ marginTop: i ? 8 : 0 }}>
              <b style={{ color: k === "Limitation" ? T.warn : T.navy }}>{k}. </b>
              <span style={{ color: T.soft }}>{v}</span>
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
