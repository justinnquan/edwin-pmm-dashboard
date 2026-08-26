/* ===========================================================================
   /components — "WHAT CHANGED" INSIGHT STRIP
=========================================================================== */
import { T } from "../theme/tokens";
import { MIN_N } from "../analytics/constants";
import type { Insight, InsightTone } from "../analytics/insights";
import { Card, Chip } from "./primitives";

export function InsightStrip({
  insights,
  suppressed,
}: {
  insights: Insight[];
  suppressed: number;
}) {
  const color: Record<InsightTone, string> = {
    positive: T.good,
    negative: T.warn,
    watch: T.blue,
  };
  const word: Record<InsightTone, string> = {
    positive: "Above baseline",
    negative: "Below baseline",
    watch: "Read carefully",
  };
  if (!insights.length) {
    return (
      <Card className="p-5">
        <div className="text-sm font-semibold" style={{ color: T.ink }}>
          No material changes to report
        </div>
        <div className="mt-1 text-xs" style={{ color: T.muted }}>
          Nothing in this segment cleared the 5% seasonally-adjusted threshold and the {MIN_N}-teacher
          minimum.
        </div>
      </Card>
    );
  }
  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}
    >
      {insights.map((i, k) => (
        <Card key={k} className="p-4" style={{ borderLeft: `3px solid ${color[i.tone]}` }}>
          <Chip tone={i.tone === "positive" ? "good" : i.tone === "negative" ? "warn" : "blue"}>
            {word[i.tone]}
          </Chip>
          <div className="mt-2 text-sm font-semibold" style={{ color: T.ink, lineHeight: 1.45 }}>
            {i.text}
          </div>
          <div className="mt-1 text-xs" style={{ color: T.muted, lineHeight: 1.5 }}>
            {i.detail}
          </div>
        </Card>
      ))}
      {suppressed > 0 && (
        <Card className="p-4" style={{ background: T.bg }}>
          <Chip>Suppressed</Chip>
          <div className="mt-2 text-sm font-semibold" style={{ color: T.soft, lineHeight: 1.45 }}>
            {suppressed} change{suppressed === 1 ? "" : "s"} hidden — sample below {MIN_N} teachers.
          </div>
          <div className="mt-1 text-xs" style={{ color: T.muted }}>
            Widen the segment or the date range to see them.
          </div>
        </Card>
      )}
    </div>
  );
}
