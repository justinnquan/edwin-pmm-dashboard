/* ===========================================================================
   /components — PROVENANCE LINE
   States what the figures on screen actually are.

   This used to be a hardcoded "prototype on seeded synthetic data" notice.
   Once a real export could be loaded, that line became the most dangerous
   text in the app: it labelled genuine Edwin numbers as illustrative, which
   is exactly the kind of caveat someone learns to ignore.
=========================================================================== */
import { T } from "../theme/tokens";
import { src } from "../data/source";

export function Provenance({ className = "" }: { className?: string }) {
  const s = src();
  const synthetic = s.id === "synthetic";
  return (
    <p className={className} style={{ color: T.muted, lineHeight: 1.6, fontSize: 12 }}>
      {synthetic ? (
        <>
          Prototype on seeded synthetic data. Figures are illustrative and must not be quoted as Edwin
          performance. Design tokens are a placeholder pending the Phia system.
        </>
      ) : (
        <>
          <b style={{ color: T.ink }}>Real data — {s.label}.</b> These are actual Edwin figures, not
          illustrative ones. Read them with the limitations named in the methodology strip above:
          {!s.coverage.canAdjust && " nothing is seasonally adjusted,"}
          {!s.coverage.seatsAreStock && " there is no licensed-seat denominator,"}
          {s.coverage.grain === "weekly" && " the grain is weekly,"} and the gate thresholds were
          calibrated against synthetic magnitudes rather than this source's noise floor.
        </>
      )}
    </p>
  );
}
