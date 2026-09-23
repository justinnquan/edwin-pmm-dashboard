/* ===========================================================================
   /data — LIVE SOURCE CLIENT
   Talks to /api/live, which serves the published real Edwin exports from a
   private store behind a shared password.

   What comes back is the same `InputFiles` the /data import produces, and it
   is turned into a source by the same `buildFileSource` — so Live cannot
   behave differently from an import of the same files. Nothing synthetic is
   mixed in: a Live source holds exactly what was published.
=========================================================================== */
import { buildFileSource, type InputFiles } from "./file/load";
import type { DataSource } from "./schema";

export const LIVE_LABEL = "Edwin 25/26 — live";

export type LiveResult =
  | { kind: "ready"; source: DataSource; publishedAt: string }
  | { kind: "locked" | "empty" | "unavailable" | "error"; message: string };

async function reason(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

export type LiveInputResult =
  | { kind: "ready"; input: InputFiles; publishedAt: string }
  | { kind: "locked" | "empty" | "unavailable" | "error"; message: string };

/** The published exports exactly as stored, before they become a source.
    The manual editor starts from these, so an edit changes what was
    published rather than a copy that has already been interpreted. */
export async function fetchLiveInput(password: string): Promise<LiveInputResult> {
  let res: Response;
  try {
    res = await fetch("/api/live", { headers: { "x-live-password": password }, cache: "no-store" });
  } catch {
    return { kind: "unavailable", message: "Could not reach the live data service." };
  }
  // A dev server without the function answers with index.html, not JSON.
  const isJson = (res.headers.get("content-type") ?? "").includes("application/json");
  if (res.status === 401) return { kind: "locked", message: await reason(res, "Incorrect password.") };
  if (res.status === 404 && isJson)
    return { kind: "empty", message: await reason(res, "No live data has been published yet.") };
  if (!isJson || res.status === 404)
    return {
      kind: "unavailable",
      message:
        "The live data service is not running here. Live works on the deployed site, or locally under vercel dev.",
    };
  if (!res.ok) return { kind: "error", message: await reason(res, `Live data failed (${res.status}).`) };
  try {
    const body = (await res.json()) as { publishedAt: string; input: InputFiles };
    return { kind: "ready", input: body.input, publishedAt: body.publishedAt };
  } catch {
    return { kind: "error", message: "The published data could not be read." };
  }
}

export async function fetchLive(password: string): Promise<LiveResult> {
  const r = await fetchLiveInput(password);
  if (r.kind !== "ready") return r;
  try {
    const report = buildFileSource({ ...r.input, label: LIVE_LABEL });
    if (!report.usable || !report.source)
      return { kind: "error", message: "The published data no longer validates. Re-publish it from Data Import." };
    return { kind: "ready", source: report.source, publishedAt: r.publishedAt };
  } catch {
    return { kind: "error", message: "The published data could not be read." };
  }
}

export async function publishLive(
  input: InputFiles,
  password: string
): Promise<{ ok: true; publishedAt: string } | { ok: false; message: string }> {
  let res: Response;
  try {
    res = await fetch("/api/live", {
      method: "POST",
      headers: { "content-type": "application/json", "x-publish-password": password },
      body: JSON.stringify(input),
    });
  } catch {
    return { ok: false, message: "Could not reach the live data service." };
  }
  const isJson = (res.headers.get("content-type") ?? "").includes("application/json");
  if (!isJson)
    return { ok: false, message: "The live data service is not running here. Publish from the deployed site." };
  if (!res.ok) return { ok: false, message: await reason(res, `Publish failed (${res.status}).`) };
  const body = (await res.json()) as { publishedAt: string };
  return { ok: true, publishedAt: body.publishedAt };
}
