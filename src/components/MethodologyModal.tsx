/* ===========================================================================
   /components — METHODOLOGY EXPLAINER
   A one-tap explainer so the caveats travel with the numbers. Opened from the
   persistent methodology strip. Esc / backdrop / close button all dismiss it;
   focus moves to the dialog on open.
=========================================================================== */
import { useEffect, useRef } from "react";
import { T } from "../theme/tokens";
import { MIN_N, MIN_DAILY_ACTIVE, MATERIALITY, CONFIDENCE_Z, BASELINE_SMOOTH } from "../analytics/constants";
import { pctAbs } from "../analytics/format";
import { Provenance } from "./Provenance";

const METHODS = [
  {
    name: "Before vs. after (seasonally adjusted)",
    label: "Observational",
    body: `The send cohort's product behaviour in the pre-window vs. the post-window, divided by how the prior-year baseline moved over the same calendar window. The baseline is a centred ±${BASELINE_SMOOTH}-day mean around the matching day 364 days back, not a single day, so one noisy day a year ago cannot manufacture an effect. Windows: 7 / 14 / 30 days.`,
  },
  {
    name: "Targeted segment vs. rest of platform",
    label: "Not a control",
    body: "The targeted population against everyone else on the platform. The two groups differ systematically — different grades, subjects and engagement levels — so this is a reference point, not a matched comparison. Where a campaign targets everyone, no comparison group exists at all and the view reports that rather than inventing one.",
  },
  {
    name: "Cohort progression",
    label: "Durability",
    body: "Following the send cohort week over week to tell a one-week spike from a lasting shift. Only weeks clearing their own uncertainty band count as evidence, and a change that held before decaying is reported as having faded rather than as a spike. Requires sufficient history.",
  },
  {
    name: "Exposed vs. unexposed with holdout",
    label: "Future",
    body: "A true comparison, only where a randomized holdout was designed into the campaign before send. Not available in this prototype.",
  },
];

export function MethodologyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center p-4 sm:p-8"
      style={{ background: "rgba(10,20,40,.45)", overflowY: "auto" }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="methodology-title"
        className="rounded-lg w-full"
        style={{ background: T.surface, maxWidth: 640, boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-start justify-between gap-4 px-6 py-4"
          style={{ borderBottom: `1px solid ${T.border}` }}
        >
          <div>
            <h2 id="methodology-title" className="text-lg font-extrabold" style={{ color: T.ink }}>
              How to read this dashboard
            </h2>
            <p className="mt-1 text-sm" style={{ color: T.soft }}>
              Association, not causation — and how each figure is gated.
            </p>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close methodology"
            className="rounded px-2 py-1 text-sm font-semibold shrink-0"
            style={{ color: T.soft, border: `1px solid ${T.border}` }}
          >
            Close
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">
          <section>
            <h3 className="text-xs font-extrabold uppercase" style={{ color: T.navy, letterSpacing: "0.06em" }}>
              Attribution methods
            </h3>
            <div className="mt-3 flex flex-col gap-3">
              {METHODS.map((m) => (
                <div key={m.name} className="rounded p-3" style={{ background: T.bg, border: `1px solid ${T.border}` }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold" style={{ color: T.ink }}>
                      {m.name}
                    </span>
                    <span
                      className="rounded px-2 py-0.5 text-xs font-semibold shrink-0"
                      style={{ color: T.blue, background: T.blue + "14" }}
                    >
                      {m.label}
                    </span>
                  </div>
                  <p className="mt-1 text-xs" style={{ color: T.soft, lineHeight: 1.6 }}>
                    {m.body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-extrabold uppercase" style={{ color: T.navy, letterSpacing: "0.06em" }}>
              Guardrails
            </h3>
            <ul className="mt-2 text-sm flex flex-col gap-1.5" style={{ color: T.soft, lineHeight: 1.5 }}>
              <li>
                <b style={{ color: T.ink }}>Seasonal baseline.</b> Prior year, smoothed over a centred
                ±{BASELINE_SMOOTH}-day window and rescaled for seat growth. K-12 usage follows the school
                calendar, so every change is read against it.
              </li>
              <li>
                <b style={{ color: T.ink }}>Minimum sample.</b> A result renders only past {MIN_N} exposed
                teachers; smaller cells show an insufficient-data state.
              </li>
              <li>
                <b style={{ color: T.ink }}>Materiality.</b> A change must clear both a {pctAbs(MATERIALITY)}{" "}
                floor <i>and</i> its own uncertainty band ({CONFIDENCE_Z} × the standard error of the
                adjusted estimate). In a quiet window the bar rises on its own, so a small sample cannot
                clear it by being noisy.
              </li>
              <li>
                <b style={{ color: T.ink }}>Minimum activity.</b> Both comparison windows must average at
                least {MIN_DAILY_ACTIVE} daily active teachers. Low-volume windows are reported as
                insufficient rather than compared.
              </li>
              <li>
                <b style={{ color: T.ink }}>Modelled adoption.</b> The activation funnel and OKR gauges are
                estimated from aggregate data, not per-user cohort events — directional, not exact.
              </li>
            </ul>
          </section>

          <p className="text-xs" style={{ color: T.muted, lineHeight: 1.6 }}>
            <Provenance />
          </p>
        </div>
      </div>
    </div>
  );
}
