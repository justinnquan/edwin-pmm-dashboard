/* ===========================================================================
   /pages — PLACEHOLDER for sections not yet built (Phases E–G)
=========================================================================== */
import { useLocation } from "react-router-dom";
import { T } from "../theme/tokens";
import { Card, Chip } from "../components/primitives";
import { navFor } from "../components/nav";

export function ComingSoon({ phase }: { phase: string }) {
  const { pathname } = useLocation();
  const meta = navFor(pathname);
  return (
    <Card className="p-8">
      <Chip tone="blue">{phase}</Chip>
      <div className="mt-3 text-lg font-extrabold" style={{ color: T.ink }}>
        {meta.title} is coming in {phase}
      </div>
      <div className="mt-2 text-sm" style={{ color: T.muted, maxWidth: 560, lineHeight: 1.6 }}>
        {meta.subtitle} This section is part of the build plan and will read from the same
        analytics layer as the pages already shipped — no new data source required.
      </div>
    </Card>
  );
}
