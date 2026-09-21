/* ===========================================================================
   /data — TARGET COMPILATION
   Turns a serializable TargetSpec into a cell predicate.

   This lives in its own module rather than beside the synthetic source
   because both the generator (campaigns.ts, generate.ts) and every data
   source need it. Putting it in synthetic.ts created an import cycle:
   synthetic.ts needs CAMPAIGNS, and campaigns.ts needed compileTarget.
=========================================================================== */
import type { Cell, TargetSpec } from "./schema";

/** An absent or empty dimension matches every value of it, so `{}` targets
    the whole platform. */
export function compileTarget(spec: TargetSpec): (c: Cell) => boolean {
  const has = (list: string[] | undefined, v: string): boolean =>
    !list || list.length === 0 || list.includes(v);
  return (c) =>
    has(spec.province, c.province) && has(spec.grade, c.grade) && has(spec.subject, c.subject);
}
