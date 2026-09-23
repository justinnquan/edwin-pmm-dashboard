/* ===========================================================================
   /components — COLLAPSIBLE SECTION
   A card whose header opens and closes its body. Used on Data Import so the
   three ways of getting data in read as three choices, not one long page.
=========================================================================== */
import { useId, useState, type ReactNode } from "react";
import { T } from "../theme/tokens";
import { Card } from "./primitives";

export function Collapsible({
  title,
  summary,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  /** One line under the title saying what this route is for. */
  summary: ReactNode;
  /** Optional chip on the right of the header. */
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <Card className="overflow-hidden" style={open ? { borderColor: `${T.blue}66` } : {}}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
        style={{ background: open ? `${T.blue}08` : T.surface }}
      >
        <span
          aria-hidden
          className="shrink-0 inline-flex items-center justify-center rounded"
          style={{
            width: 22,
            height: 22,
            color: T.blue,
            transform: open ? "rotate(90deg)" : "none",
            transition: "transform 120ms ease",
            fontSize: 12,
          }}
        >
          ▶
        </span>
        <span className="flex-1 min-w-0">
          <span
            className="block text-sm font-extrabold uppercase"
            style={{ color: T.navy, letterSpacing: "0.07em" }}
          >
            {title}
          </span>
          <span className="block mt-0.5 text-xs" style={{ color: T.muted, lineHeight: 1.5 }}>
            {summary}
          </span>
        </span>
        {badge && <span className="shrink-0 hidden sm:inline">{badge}</span>}
      </button>
      {/* Kept mounted while closed, so chosen files and unsaved edits survive
          collapsing the section. */}
      <div id={id} hidden={!open} className="px-5 pb-5 pt-4" style={{ borderTop: `1px solid ${T.border}` }}>
        {children}
      </div>
    </Card>
  );
}
