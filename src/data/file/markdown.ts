/* ===========================================================================
   /data/file — MARKDOWN PIPE TABLES
   Parses Obsidian / GitHub-flavoured pipe tables into the same row shape the
   CSV parser produces.

   This exists because the real Edwin usage export lives in an Obsidian vault
   as a markdown table. Asking the owner to re-key it into CSV every month is
   a step that would eventually be skipped or fumbled; the format is
   unambiguous enough to just read.

   A file may contain several tables. Each is returned separately so the
   caller can pick the one whose headers it recognises — the real file holds
   both a weekly and a monthly rollup, and only the weekly one is wanted.
=========================================================================== */

export interface MarkdownTable {
  headers: string[];
  rows: Record<string, string>[];
}

/** True for a markdown alignment row: `|---|--:|` and friends. */
const isDivider = (cells: string[]): boolean =>
  cells.length > 0 && cells.every((c) => /^:?-{1,}:?$/.test(c.replace(/\s/g, "")));

const splitRow = (line: string): string[] =>
  line
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((c) => c.trim());

/** Normalise a header into the lowercase snake_case the loader matches on. */
export const normaliseHeader = (h: string): string =>
  h
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

/** Strip thousands separators and stray symbols so "1,234" reads as a number. */
export const cleanNumeric = (v: string): string => v.replace(/[,\s$]/g, "");

export function parseMarkdownTables(text: string): MarkdownTable[] {
  const lines = text.split(/\r?\n/);
  const tables: MarkdownTable[] = [];

  let headers: string[] | null = null;
  let pending: string[] | null = null;
  let rows: Record<string, string>[] = [];

  const flush = () => {
    if (headers && rows.length) tables.push({ headers, rows });
    headers = null;
    rows = [];
  };

  for (const line of lines) {
    if (!line.includes("|")) {
      // A non-table line ends the current table.
      flush();
      pending = null;
      continue;
    }
    const cells = splitRow(line);

    if (isDivider(cells)) {
      // The line before a divider was the header row.
      if (pending) {
        flush();
        headers = pending.map(normaliseHeader);
        pending = null;
      }
      continue;
    }

    if (!headers) {
      pending = cells;
      continue;
    }

    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? "";
    });
    if (Object.values(row).some((v) => v !== "")) rows.push(row);
  }
  flush();
  return tables;
}

/** Pick the first table containing every one of `required` (normalised). */
export function tableWith(tables: MarkdownTable[], required: string[]): MarkdownTable | null {
  return tables.find((t) => required.every((r) => t.headers.includes(r))) ?? null;
}
