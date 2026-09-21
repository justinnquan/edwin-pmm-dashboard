/* ===========================================================================
   /data — THE SWAP POINT
   One module answers "where does this app's data come from". Everything above
   /data calls `src()`; nothing above /data imports a generator module.

   Why a module singleton rather than a parameter or a React context:

   - Threading a `DataSource` argument through /analytics would change ~25
     function signatures and ~80 call sites, and every future edit would have
     to remember to pass it.
   - A React context cannot work: the analytics functions are plain functions,
     not hooks, and `scripts/null-test.ts` runs them in Node with no React at
     all.

   The trade-off is that the source is ambient rather than explicit. That is
   acceptable because there is exactly one of it per process, and it is set in
   exactly two places: the default below, and the upload flow.
=========================================================================== */
import type { DataSource } from "./schema";
import { createSyntheticSource } from "./synthetic";

let current: DataSource = createSyntheticSource();

/** The active data source. Call it per use rather than hoisting the result to
    a module constant, or a swap will not be observed. */
export const src = (): DataSource => current;

/** Replace the active source. Callers in the UI should go through
    `useDataSource().swap()` so that React is told to re-render. */
export function setSource(next: DataSource): void {
  current = next;
}

/** Restore the built-in synthetic generator. */
export function resetSource(): void {
  current = createSyntheticSource();
}
