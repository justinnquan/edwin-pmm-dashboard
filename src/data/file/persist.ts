/* ===========================================================================
   /data/file — SESSION PERSISTENCE
   Keeps an imported CSV alive across page reloads.

   sessionStorage, not localStorage, and deliberately so. This holds real
   Edwin numbers, and sessionStorage is scoped to the tab and cleared when it
   closes — the data does not outlive the working session or leak into other
   tabs. It is also synchronous, so rehydration happens before the first
   render with no async boot and no loading flash.

   The raw CSV text is stored rather than the parsed source, because a parsed
   DataSource contains compiled predicates and Maps that will not survive
   JSON. Re-parsing on boot costs a few hundred milliseconds and keeps exactly
   one code path for building a source.
=========================================================================== */
import type { InputFiles } from "./load";

const KEY = "edwin-pmm.import.v1";

/** Rough sessionStorage ceiling; browsers vary but 5 MB is the common floor. */
const LIMIT = 4_500_000;

export function saveImport(files: InputFiles): { ok: boolean; reason?: string } {
  try {
    const payload = JSON.stringify(files);
    if (payload.length > LIMIT) {
      return {
        ok: false,
        reason: `The import is ${(payload.length / 1e6).toFixed(1)} MB, over the browser's session-storage limit. The dashboard is using it now, but it will not survive a page reload.`,
      };
    }
    sessionStorage.setItem(KEY, payload);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason:
        "The browser refused to store the import, so it will not survive a page reload. " +
        (e instanceof Error ? e.message : ""),
    };
  }
}

export function readImport(): InputFiles | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InputFiles;
    return parsed.dailyFacts && parsed.campaigns ? parsed : null;
  } catch {
    return null;
  }
}

export function clearImport(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to do — a browser that refuses to clear also refused to store */
  }
}
