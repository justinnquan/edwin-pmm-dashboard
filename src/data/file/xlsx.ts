/* ===========================================================================
   /data/file — XLSX READER
   Reads an Excel workbook into plain rows, with no dependency: an .xlsx is a
   ZIP of XML, and the browser can already inflate.

   This exists so the real Pardot / YesWare campaign export can be loaded as
   the owner actually keeps it, rather than requiring a manual re-export to
   CSV every time the numbers are refreshed.

   Two traps, both of which produce silently wrong data rather than an error,
   and both of which cost real debugging time:

   1. SELF-CLOSING CELLS. Empty styled cells are written `<c r="A4" s="116"/>`.
      A naive `<c ...>(.*?)</c>` pairs that opening tag with the *next* cell's
      closing tag, so every value shifts one column left and the `t` attribute
      read belongs to the wrong cell. Handled by matching `/>` explicitly.

   2. SHARED STRINGS. A cell with `t="s"` holds an *index* into
      sharedStrings.xml, not a value. Miss it and text columns render as
      small integers that look like plausible data.
=========================================================================== */

export interface Sheet {
  name: string;
  /** Row-major, sparse. `rows[i][j]` is undefined where the cell was empty. */
  rows: (string | undefined)[][];
}

/* --- ZIP ------------------------------------------------------------------ */

const EOCD_SIG = 0x06054b50;
const CD_SIG = 0x02014b50;

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error(
      "This browser cannot decompress .xlsx files. Export the sheet as CSV and load that instead."
    );
  }
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Read the ZIP central directory, which always carries correct sizes —
    unlike local headers, which may defer them to a trailing data descriptor. */
async function unzip(buf: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const dv = new DataView(buf);
  const bytes = new Uint8Array(buf);

  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= 0 && i > buf.byteLength - 66000; i--) {
    if (dv.getUint32(i, true) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a valid .xlsx file (no ZIP directory found).");

  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);

  const out = new Map<string, Uint8Array>();
  const dec = new TextDecoder();

  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== CD_SIG) break;
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const localOff = dv.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));

    // Skip the local header, whose own name/extra lengths may differ.
    const lNameLen = dv.getUint16(localOff + 26, true);
    const lExtraLen = dv.getUint16(localOff + 28, true);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = bytes.subarray(dataStart, dataStart + compSize);

    if (name.endsWith(".xml") || name.endsWith(".rels")) {
      out.set(name, method === 0 ? raw : await inflateRaw(raw));
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/* --- XML ------------------------------------------------------------------ */

const XML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

const unescapeXml = (s: string): string =>
  s
    .replace(/&(amp|lt|gt|quot|apos);/g, (m) => XML_ENTITIES[m])
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)));

/** "BC" -> 54. Column letters are base-26 with no zero. */
function colIndex(ref: string): number {
  const m = /^([A-Z]+)/.exec(ref);
  if (!m) return 0;
  let n = 0;
  for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/* Matches a cell in either form: self-closing, or with a body.
   The `(?:\/>|>...<\/c>)` alternation is what keeps trap 1 from biting. */
const CELL_RE = /<c\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;

function parseSheet(xml: string, shared: string[]): (string | undefined)[][] {
  const rows: (string | undefined)[][] = [];
  // Splitting on </row> first keeps the per-cell regex working over small
  // strings; run against a 17 MB sheet in one pass it backtracks for minutes.
  for (const chunk of xml.split("</row>")) {
    const rm = /<row[^>]*\sr="(\d+)"/.exec(chunk);
    if (!rm) continue;
    const cells: (string | undefined)[] = [];
    CELL_RE.lastIndex = 0;
    let c: RegExpExecArray | null;
    while ((c = CELL_RE.exec(chunk))) {
      const [, attrs, body] = c;
      if (body === undefined) continue; // self-closing: genuinely empty
      const ref = /r="([A-Z]+\d+)"/.exec(attrs);
      if (!ref) continue;
      const t = /t="([^"]+)"/.exec(attrs)?.[1];
      let value: string | undefined;
      if (t === "inlineStr") {
        value = /<t[^>]*>([\s\S]*?)<\/t>/.exec(body)?.[1];
      } else {
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        if (v === undefined) continue;
        value = t === "s" ? shared[+v] : v;
      }
      if (value === undefined || value === "") continue;
      cells[colIndex(ref[1])] = unescapeXml(value);
    }
    if (cells.some((x) => x !== undefined)) rows[+rm[1]] = cells;
  }
  return rows;
}

/* --- Public API ------------------------------------------------------------ */

export async function readWorkbook(buf: ArrayBuffer): Promise<Sheet[]> {
  const files = await unzip(buf);
  const dec = new TextDecoder();
  const text = (p: string): string => {
    const b = files.get(p);
    return b ? dec.decode(b) : "";
  };

  const shared = [...text("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => unescapeXml(x[1])).join("")
  );

  // r:id -> worksheet path
  const rels = new Map<string, string>();
  for (const m of text("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\s([^>]*)>/g)) {
    const id = /Id="([^"]+)"/.exec(m[1])?.[1];
    const target = /Target="([^"]+)"/.exec(m[1])?.[1];
    if (id && target && target.includes("worksheets/")) {
      rels.set(id, "xl/" + target.replace(/^\/?xl\//, ""));
    }
  }

  const sheets: Sheet[] = [];
  for (const m of text("xl/workbook.xml").matchAll(/<sheet\s([^>]*)\/?>/g)) {
    const name = /name="([^"]*)"/.exec(m[1])?.[1];
    const rid = /r:id="([^"]+)"/.exec(m[1])?.[1];
    if (!name || !rid) continue;
    const path = rels.get(rid);
    if (!path) continue;
    const xml = text(path);
    if (!xml) continue;
    sheets.push({ name: unescapeXml(name), rows: parseSheet(xml, shared) });
  }
  return sheets;
}

/** Excel stores dates as a serial day count. Convert to an ISO date. */
export function excelDate(v: string | undefined): string | null {
  if (!v || !/^\d{4,6}(\.\d+)?$/.test(v)) return null;
  const n = Number(v);
  // Guard the plausible range so a metric like 45000 clicks is not read as 2023.
  if (n < 20000 || n > 60000) return null;
  return new Date(Math.round((n - 25569) * 86400000)).toISOString().slice(0, 10);
}
