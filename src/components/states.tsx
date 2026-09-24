/* ===========================================================================
   /components — SHARED STATE VIEWS
   Empty, loading, and insufficient-data states, designed to be instructive
   (each states what would bring data back or what tracking is required).
=========================================================================== */
import type { ReactNode } from "react";
import { T } from "../theme/tokens";
import { Card } from "./primitives";

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <Card className="p-6">
      <div className="text-lg font-bold" style={{ color: T.ink }}>
        {title}
      </div>
      {children && (
        <div className="mt-1 text-base" style={{ color: T.soft, lineHeight: 1.6, maxWidth: 600 }}>
          {children}
        </div>
      )}
    </Card>
  );
}

/** Fallback shown under the app shell while a lazy-loaded page resolves. */
export function PageLoading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-lg shimmer"
            style={{ height: 116, background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadowSm }}
          />
        ))}
      </div>
      <div
        className="rounded-lg shimmer"
        style={{ height: 320, background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadowSm }}
      />
    </div>
  );
}

/** A surface that cannot be drawn from the active source. Distinct from an
    empty state: the data is not missing for this filter, it is absent from the
    source entirely, and the reader needs to know which. */
export function Unavailable({ title, detail }: { title: string; detail: string }) {
  return (
    <div
      className="rounded-md p-4"
      style={{ border: `1px dashed ${T.faint}`, background: T.subtle, lineHeight: 1.6 }}
    >
      <div className="text-sm font-semibold" style={{ color: T.soft }}>
        {title}
      </div>
      <div className="mt-1 text-sm" style={{ color: T.muted }}>
        {detail}
      </div>
    </div>
  );
}
