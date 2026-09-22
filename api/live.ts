/* ===========================================================================
   /api — LIVE DATA
   Serves the published real Edwin exports to the dashboard's Live mode, and
   accepts a new publish from /data.

   The repository is public, so real figures can never be bundled into the
   site. They live in one private Vercel Blob instead, which is readable only
   with the store token held server-side — never by URL. Two passwords gate
   it, both Vercel environment variables:

     LIVE_VIEW_PASSWORD     shared with anyone who should see Live
     LIVE_PUBLISH_PASSWORD  held by the owner; replaces what Live shows

   The payload is the same `InputFiles` shape the /data import builds, so the
   client runs it through the one loader every other source goes through.
   Validation happens in the browser before a publish is offered; this
   endpoint only checks shape, and deliberately imports nothing from /src so
   the function stays self-contained.
=========================================================================== */
import { get, put } from "@vercel/blob";

const PATHNAME = "live/edwin-live.json";
/** Vercel's request body ceiling is 4.5 MB; stay clear of it. */
const MAX_BYTES = 4_000_000;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

/** Constant-time comparison. Hashing first gives both sides equal length, so
    neither the length nor the first mismatching byte leaks through timing. */
async function same(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const p = new Uint8Array(x);
  const q = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < p.length; i++) diff |= p[i] ^ q[i];
  return diff === 0;
}

function configured(name: "LIVE_VIEW_PASSWORD" | "LIVE_PUBLISH_PASSWORD"): string | null {
  const v = process.env[name];
  return v && process.env.BLOB_READ_WRITE_TOKEN ? v : null;
}

export async function GET(request: Request): Promise<Response> {
  const expected = configured("LIVE_VIEW_PASSWORD");
  if (!expected) return json(503, { error: "Live data is not configured on this deployment." });
  const given = request.headers.get("x-live-password") ?? "";
  if (!(await same(given, expected))) return json(401, { error: "Incorrect password." });

  let text: string;
  try {
    const found = await get(PATHNAME, { access: "private", useCache: false });
    if (!found || found.statusCode !== 200) return json(404, { error: "No live data has been published yet." });
    text = await new Response(found.stream).text();
  } catch (e) {
    return json(502, { error: `The live data store could not be read. ${e instanceof Error ? e.message : ""}`.trim() });
  }
  return new Response(text, {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export async function POST(request: Request): Promise<Response> {
  const expected = configured("LIVE_PUBLISH_PASSWORD");
  if (!expected) return json(503, { error: "Publishing is not configured on this deployment." });
  const given = request.headers.get("x-publish-password") ?? "";
  if (!(await same(given, expected))) return json(401, { error: "Incorrect publish password." });

  const text = await request.text();
  if (text.length > MAX_BYTES) return json(413, { error: "The export is too large to publish." });

  let input: { dailyFacts?: unknown; campaigns?: unknown; label?: unknown };
  try {
    input = JSON.parse(text);
  } catch {
    return json(400, { error: "The payload is not valid JSON." });
  }
  // Both tables are required by the loader; refuse anything that could not
  // build a source rather than publishing something Live cannot render.
  if (!input || typeof input !== "object" || !input.dailyFacts || !input.campaigns) {
    return json(400, { error: "The payload needs both usage and campaign data." });
  }

  const publishedAt = new Date().toISOString();
  try {
    await put(PATHNAME, JSON.stringify({ publishedAt, input }), {
      access: "private",
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType: "application/json",
    });
  } catch (e) {
    return json(502, { error: `The live data store refused the publish. ${e instanceof Error ? e.message : ""}`.trim() });
  }
  return json(200, { publishedAt });
}
