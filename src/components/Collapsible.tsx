/* ===========================================================================
   /components — COLLAPSIBLE SECTION
   A card whose header opens and closes its body. Used on Data Import so the
   three ways of getting data in read as three choices, not one long page.
=========================================================================== */
import { useId, useState, type ReactNode } from "react";
import { T } from "../theme/tokens";
import { Card } from "./primitives";
import { Icon } from "./Icon";

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
    <Card className="overflow-hidden" style={open ? { borderColor: T.blue200 } : {}}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        className="w-full flex items-center gap-3 px-6 py-4 text-left"
        style={{ background: open ? T.blue100 : T.surface }}
      >
        <span
          aria-hidden
          className="shrink-0 inline-flex items-center justify-center rounded"
          style={{
            width: 22,
            height: 22,
            color: T.blue,
            transform: open ? "rotate(90deg)" : "none",
            transition: "transform 200ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <Icon name="chevron" size={14} />
        </span>
        <span className="flex-1 min-w-0">
          <span
            className="block text-base font-bold"
            style={{ color: T.ink }}
          >
            {title}
          </span>
          <span className="block mt-0.5 text-sm" style={{ color: T.muted, lineHeight: 1.5 }}>
            {summary}
          </span>
        </span>
        {badge && <span className="shrink-0 hidden sm:inline">{badge}</span>}
      </button>
      {/* Kept mounted while closed, so chosen files and unsaved edits survive
          collapsing the section. */}
      <div id={id} hidden={!open} className="px-6 pb-6 pt-5" style={{ borderTop: `1px solid ${T.border}` }}>
        {children}
      </div>
    </Card>
  );
}
