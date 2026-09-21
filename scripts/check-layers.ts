/* ===========================================================================
   scripts/check-layers.ts — architectural barrier, enforced.

   Run with:  npm run check:layers   (also runs as part of npm run build)

   Two rules the project has always claimed but never enforced:

   1. GROUND-TRUTH BARRIER. Nothing above /data may import the synthetic
      generator. `calendar.ts` holds the seasonal model the analytics layer is
      supposed to recover from prior-year data on its own, plus a provisioned
      seat curve that is pure fiction; `campaigns.ts` holds `effects`, the
      answer key. Until this check existed the barrier was a comment, and
      `provisioned()` had leaked into five analytics files and one page.

   2. THE SWAP POINT IS THE ONLY DOOR. Everything above /data reaches data
      through `src()`, so replacing the source replaces the whole app's data.

   Scripts are exempt: null-test.ts legitimately reads `effects` to score how
   well the method recovers a known answer.
=========================================================================== */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath, not URL.pathname: this repo lives under a directory whose
// name contains spaces, which pathname leaves percent-encoded.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Modules above /data may not import these. */
const FORBIDDEN = ["calendar", "generate", "campaigns", "segments", "synthetic"];

/** Directories subject to the barrier. */
const GUARDED = ["src/analytics", "src/components", "src/pages", "src/state", "src/lib"];

function walk(dir: string): string[] {
  let out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

const violations: string[] = [];
let scanned = 0;

for (const dir of GUARDED) {
  // Deliberately not wrapped in try/catch. A guarded directory that cannot be
  // read must fail loudly: swallowing the error would make this script report
  // success while checking nothing at all.
  const files = walk(join(ROOT, dir));
  scanned += files.length;
  for (const file of files) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        const m = line.match(/from\s+"([^"]*\/data\/[a-zA-Z]+)"/);
        if (!m) return;
        const mod = m[1].split("/").pop()!;
        if (FORBIDDEN.includes(mod)) {
          violations.push(
            `${relative(ROOT, file).replace(/\\/g, "/")}:${i + 1}  imports data/${mod} — ` +
              `generator ground truth. Reach data through src() in data/source.ts.`
          );
        }
      });
  }
}

if (!scanned) {
  console.error("LAYER CHECK FAILED — scanned 0 files. The guarded paths are wrong.");
  process.exit(1);
}

if (violations.length) {
  console.error("\nLAYER CHECK FAILED\n");
  for (const v of violations) console.error("  " + v);
  console.error(
    `\n${violations.length} violation(s). The synthetic generator must not be ` +
      `reachable above /data, or the real-data swap will not work.\n`
  );
  process.exit(1);
}

console.log(`Layer check passed — ${scanned} files, no generator imports above /data.`);
