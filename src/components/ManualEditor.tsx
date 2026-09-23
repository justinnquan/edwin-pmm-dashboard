/* ===========================================================================
   /components — MANUAL DATA EDITOR
   Change, add or remove rows of the published data without a file.

   It starts from what Live holds — the stored rows, not the interpreted
   source — and hands its result back as the same `InputFiles` an upload
   produces. That keeps one road in: the edited rows go through the loader's
   validation report and the same Preview / Publish buttons as a file, so a
   hand edit cannot reach the dashboard by a path that skips the checks.
=========================================================================== */
import { useMemo, useState } from "react";
import { T, num } from "../theme/tokens";
import { Chip } from "./primitives";
import { fetchLiveInput } from "../data/live";
import { buildFileSource, parseCsv, type InputFiles, type Row, type ValidationReport } from "../data/file/load";
import { DAILY_FACTS, CAMPAIGNS_TABLE, RELEASES_TABLE, type ColumnSpec } from "../data/file/schema";
import { rememberLivePassword, storedLivePassword } from "../state/dataStore";
import { addDays, fmtShort, fromIso, iso } from "../lib/dates";

type TableKey = "facts" | "campaigns" | "releases";

interface EditRow {
  /** Stable React key and identity for change tracking. */
  key: string;
  /** The row as loaded; absent for a row added here. */
  orig?: Row;
  row: Row;
}

type Draft = Record<TableKey, EditRow[]>;

const TABLE_META: Record<TableKey, { label: string; spec: { columns: ColumnSpec[] }; dateCol: string[] }> = {
  facts: { label: "Weekly usage", spec: DAILY_FACTS, dateCol: ["week_starting", "date"] },
  campaigns: { label: "Campaigns", spec: CAMPAIGNS_TABLE, dateCol: ["launch_date"] },
  releases: { label: "Releases", spec: RELEASES_TABLE, dateCol: ["date"] },
};

/** Plain-language headers for the columns people actually edit. */
const LABEL: Record<string, string> = {
  week_starting: "Week starting",
  date: "Date",
  wau: "Weekly engaged teachers",
  cumulative_logins: "Total logged-in teachers",
  new_logins: "New logins",
  name: "Name",
  type: "Type",
  channel: "Channel",
  launch_date: "Sent",
  audience: "Audience",
  sends: "Delivered",
  opens: "Opens",
  clicks: "Clicks",
  recipients: "Recipients",
  objective_metric: "Objective",
  target_province: "Province",
  target_grade: "Grade",
  target_subject: "Subject",
};

/** Columns a blank start offers — the shape the Edwin exports produce. */
const BLANK_COLUMNS: Record<TableKey, string[]> = {
  facts: ["week_starting", "wau", "cumulative_logins"],
  campaigns: ["campaign_id", "name", "type", "channel", "launch_date", "audience", "sends", "opens", "clicks", "recipients", "objective_metric"],
  releases: ["date", "name"],
};

const OBJECTIVES = ["wau", "resourceOpens", "assignmentsCreated", "classesCreated", "ahaUsers"];
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

// A random prefix per module load keeps keys unique even if the counter
// restarts (a hot reload in development) while rows are still on screen.
const KEY_PREFIX = Math.random().toString(36).slice(2, 8);
let seq = 0;
const nextKey = () => `${KEY_PREFIX}-${++seq}`;

function kindOf(table: TableKey, col: string): ColumnSpec["kind"] {
  if (col === "week_starting") return "date";
  return TABLE_META[table].spec.columns.find((c) => c.name === col)?.kind ?? "text";
}

/** Rows of one table from a stored input: parsed rows when the source was a
    markdown table or workbook, CSV text otherwise. */
function rowsOf(input: InputFiles, table: TableKey): Row[] {
  const parsed = table === "facts" ? input.parsed?.facts : table === "campaigns" ? input.parsed?.campaigns : input.parsed?.releases;
  if (parsed) return parsed;
  const text = table === "facts" ? input.dailyFacts : table === "campaigns" ? input.campaigns : input.releases;
  // "edwin" is the placeholder the Edwin adapter stores beside parsed rows.
  return text && text !== "edwin" && text !== "manual" ? parseCsv(text) : [];
}

function dateOf(table: TableKey, r: Row): string {
  for (const c of TABLE_META[table].dateCol) if (r[c]) return r[c];
  return "";
}

function toDraft(input: InputFiles | null): Draft {
  const make = (t: TableKey): EditRow[] =>
    (input ? rowsOf(input, t) : [])
      .map((r) => ({ key: nextKey(), orig: r, row: { ...r } }))
      .sort((a, b) => dateOf(t, a.row).localeCompare(dateOf(t, b.row)));
  return { facts: make("facts"), campaigns: make("campaigns"), releases: make("releases") };
}

/** Column order: the contract's order first, then anything else present. */
function columnsOf(table: TableKey, rows: EditRow[]): string[] {
  const seen = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r.row)) seen.add(k);
  if (!seen.size) BLANK_COLUMNS[table].forEach((c) => seen.add(c));
  const order = ["week_starting", ...TABLE_META[table].spec.columns.map((c) => c.name)];
  return [...order.filter((c) => seen.has(c)), ...[...seen].filter((c) => !order.includes(c))];
}

function invalid(table: TableKey, col: string, v: string): boolean {
  if (v === "" || v == null) return false; // required-ness is the loader's call
  const kind = kindOf(table, col);
  if (kind === "date") return !ISO_RE.test(v);
  if (kind === "number" || kind === "rate") {
    const n = Number(String(v).replace(/,/g, ""));
    return !Number.isFinite(n) || n < 0;
  }
  return false;
}

const same = (a: Row | undefined, b: Row) =>
  !!a && Object.keys({ ...a, ...b }).every((k) => (a[k] ?? "") === (b[k] ?? ""));

export function ManualEditor({ onReport }: { onReport: (r: ValidationReport, input: InputFiles) => void }) {
  const [base, setBase] = useState<InputFiles | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [removed, setRemoved] = useState<Record<TableKey, number>>({ facts: 0, campaigns: 0, releases: 0 });
  const [tab, setTab] = useState<TableKey>("facts");
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState<{ busy?: boolean; message?: string; needPw?: boolean; from?: string } | null>(null);
  const [pw, setPw] = useState("");

  const load = async (password?: string) => {
    const use = password ?? storedLivePassword();
    if (!use) return setStatus({ needPw: true });
    setStatus({ busy: true });
    const r = await fetchLiveInput(use);
    if (r.kind === "ready") {
      if (password) rememberLivePassword(password);
      setBase(r.input);
      setDraft(toDraft(r.input));
      setRemoved({ facts: 0, campaigns: 0, releases: 0 });
      setStatus({ from: `Live, published ${fmtShort(r.publishedAt.slice(0, 10))}` });
      return;
    }
    setStatus({ message: r.message, needPw: r.kind === "locked" });
  };

  const startBlank = () => {
    setBase(null);
    setDraft(toDraft(null));
    setRemoved({ facts: 0, campaigns: 0, releases: 0 });
    setStatus({ from: "a blank table" });
  };

  const rows = draft?.[tab] ?? [];
  const cols = useMemo(() => columnsOf(tab, rows), [tab, rows]);
  // campaign_id is a key, not something to type: it is generated for new rows.
  const shownCols = cols.filter((c) => c !== "campaign_id");

  const counts = useMemo(() => {
    const c = { edited: 0, added: 0, removed: 0 };
    if (!draft) return c;
    for (const t of Object.keys(draft) as TableKey[]) {
      for (const r of draft[t]) {
        if (!r.orig) c.added++;
        else if (!same(r.orig, r.row)) c.edited++;
      }
      c.removed += removed[t];
    }
    return c;
  }, [draft, removed]);
  const dirty = counts.edited + counts.added + counts.removed > 0;
  const errors = useMemo(() => {
    if (!draft) return 0;
    let n = 0;
    for (const t of Object.keys(draft) as TableKey[])
      for (const r of draft[t]) for (const [k, v] of Object.entries(r.row)) if (invalid(t, k, v)) n++;
    return n;
  }, [draft]);

  const setCell = (key: string, col: string, v: string) =>
    setDraft((d) => d && { ...d, [tab]: d[tab].map((r) => (r.key === key ? { ...r, row: { ...r.row, [col]: v } } : r)) });

  const remove = (key: string) => {
    const r = draft?.[tab].find((x) => x.key === key);
    if (r?.orig) setRemoved((m) => ({ ...m, [tab]: m[tab] + 1 }));
    setDraft((d) => d && { ...d, [tab]: d[tab].filter((x) => x.key !== key) });
  };

  const add = () => {
    const blank: Row = Object.fromEntries(cols.map((c) => [c, ""]));
    const last = rows.reduce<Row | undefined>(
      (best, r) => (!best || dateOf(tab, r.row) > dateOf(tab, best) ? r.row : best),
      undefined
    );
    if (tab === "facts") {
      const col = cols.includes("week_starting") ? "week_starting" : "date";
      const prev = last?.[col];
      // The week after the last one, which is almost always the one being added.
      if (prev && ISO_RE.test(prev)) blank[col] = iso(addDays(fromIso(prev), col === "week_starting" ? 7 : 1));
      for (const seg of ["province", "grade", "subject"]) if (last?.[seg]) blank[seg] = last[seg];
    }
    if (tab === "campaigns") {
      blank.campaign_id = `manual-${Date.now().toString(36)}`;
      blank.objective_metric = "wau";
      blank.clicks = "0";
    }
    setDraft((d) => d && { ...d, [tab]: [...d[tab], { key: nextKey(), row: blank }] });
    setFilter("");
  };

  const discard = () => {
    setDraft(toDraft(base));
    setRemoved({ facts: 0, campaigns: 0, releases: 0 });
  };

  const validate = () => {
    if (!draft) return;
    const strip = (list: EditRow[]) => list.map((r) => r.row);
    const input: InputFiles = {
      dailyFacts: draft.facts.length ? "manual" : undefined,
      campaigns: draft.campaigns.length ? "manual" : undefined,
      releases: draft.releases.length ? "manual" : undefined,
      reach: base?.reach,
      parsed: {
        facts: strip(draft.facts),
        campaigns: strip(draft.campaigns),
        releases: strip(draft.releases),
        reach: base?.parsed?.reach,
      },
      label: base?.label ?? "Edwin export",
    };
    onReport(buildFileSource(input), input);
  };

  // Newest first, so the week or campaign just added sits at the top rather
  // than below dozens of rows. A row with no date yet counts as newest.
  const visible = (
    filter
      ? rows.filter((r) => Object.values(r.row).some((v) => String(v).toLowerCase().includes(filter.toLowerCase())))
      : rows
  )
    .slice()
    .sort((a, b) => {
      const da = dateOf(tab, a.row);
      const db = dateOf(tab, b.row);
      if (!da || !db) return !da && !db ? 0 : !da ? -1 : 1;
      return db.localeCompare(da);
    });

  /* --- Not loaded yet ------------------------------------------------------ */
  if (!draft) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-xs" style={{ color: T.soft, lineHeight: 1.6 }}>
          Loads the rows Live holds now — weekly usage, campaigns and releases — so you can correct a
          figure, add this week, or remove a campaign without re-exporting anything. Changes go through
          the same validation report, then Preview or Publish.
        </p>
        {status?.needPw && (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (pw) void load(pw);
            }}
          >
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Live password"
              aria-label="Live password"
              className="rounded px-2 py-1 text-sm"
              style={{ border: `1px solid ${T.border}`, color: T.ink, background: T.surface }}
            />
            <button type="submit" disabled={!pw} className="rounded px-3 py-1 text-sm font-bold" style={{ color: T.surface, background: pw ? T.blue : T.muted }}>
              Unlock and load
            </button>
          </form>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {!status?.needPw && (
            <button
              type="button"
              onClick={() => void load()}
              disabled={status?.busy}
              className="rounded px-4 py-2 text-sm font-bold"
              style={{ color: T.surface, background: status?.busy ? T.muted : T.blue }}
            >
              {status?.busy ? "Loading…" : "Load Live data to edit"}
            </button>
          )}
          <button
            type="button"
            onClick={startBlank}
            className="rounded px-3 py-2 text-sm font-semibold"
            style={{ color: T.blue, border: `1px solid ${T.blue}55`, background: T.surface }}
          >
            Start from a blank table
          </button>
        </div>
        {status?.message && (
          <p className="text-xs" style={{ color: T.warn, lineHeight: 1.6 }}>
            {status.message}
          </p>
        )}
      </div>
    );
  }

  /* --- Editing ------------------------------------------------------------- */
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded p-0.5" role="tablist" aria-label="Table" style={{ background: T.bg, border: `1px solid ${T.border}` }}>
          {(Object.keys(TABLE_META) as TableKey[]).map((t) => {
            const on = tab === t;
            return (
              <button
                key={t}
                role="tab"
                aria-selected={on}
                type="button"
                onClick={() => {
                  setTab(t);
                  setFilter("");
                }}
                className="rounded px-3 py-1 text-sm font-semibold whitespace-nowrap"
                style={{
                  background: on ? T.surface : "transparent",
                  color: on ? T.blue : T.muted,
                  border: on ? `1px solid ${T.border}` : "1px solid transparent",
                }}
              >
                {TABLE_META[t].label} <span style={{ ...num, color: T.muted }}>· {draft[t].length}</span>
              </button>
            );
          })}
        </div>
        <span className="text-xs" style={{ color: T.muted }}>
          Editing {status?.from}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={`Filter ${TABLE_META[tab].label.toLowerCase()}…`}
          aria-label="Filter rows"
          className="rounded px-2 py-1 text-sm"
          style={{ border: `1px solid ${T.border}`, color: T.ink, background: T.surface, minWidth: 220 }}
        />
        <button
          type="button"
          onClick={add}
          className="rounded px-3 py-1 text-sm font-semibold"
          style={{ color: T.blue, border: `1px solid ${T.blue}55`, background: T.surface }}
        >
          + Add {tab === "facts" ? "week" : tab === "campaigns" ? "campaign" : "release"}
        </button>
        {filter && (
          <span className="text-xs" style={{ color: T.muted }}>
            {visible.length} of {rows.length} shown
          </span>
        )}
      </div>

      <div className="rounded" style={{ border: `1px solid ${T.border}`, maxHeight: 440, overflow: "auto" }}>
        <table className="w-full text-sm" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr>
              {shownCols.map((c) => (
                <th
                  key={c}
                  className="px-2 py-2 text-left text-xs font-bold uppercase whitespace-nowrap"
                  style={{ position: "sticky", top: 0, background: T.bg, color: T.muted, letterSpacing: "0.04em", borderBottom: `1px solid ${T.border}`, zIndex: 1 }}
                >
                  {LABEL[c] ?? c}
                </th>
              ))}
              <th style={{ position: "sticky", top: 0, background: T.bg, borderBottom: `1px solid ${T.border}`, zIndex: 1 }} aria-label="Remove" />
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={shownCols.length + 1} className="px-3 py-6 text-center text-sm" style={{ color: T.muted }}>
                  {rows.length ? "No rows match the filter." : "No rows yet — add one above."}
                </td>
              </tr>
            )}
            {visible.map((r) => {
              const added = !r.orig;
              return (
                <tr key={r.key} style={{ background: added ? `${T.good}0D` : "transparent" }}>
                  {shownCols.map((c) => {
                    const v = r.row[c] ?? "";
                    const kind = kindOf(tab, c);
                    const changed = !added && (r.orig?.[c] ?? "") !== v;
                    const bad = invalid(tab, c, v);
                    const border = bad ? T.warn : changed ? T.blue : T.border;
                    const common = {
                      "aria-label": `${LABEL[c] ?? c}`,
                      className: "w-full rounded px-1.5 py-1 text-sm",
                      style: {
                        border: `1px solid ${border}`,
                        background: changed ? `${T.blue}0D` : T.surface,
                        color: T.ink,
                        minWidth: kind === "date" ? 138 : kind === "number" || kind === "rate" ? 96 : c === "name" ? 240 : 120,
                        ...(kind === "number" || kind === "rate" ? num : {}),
                      },
                    };
                    return (
                      <td key={c} className="px-1.5 py-1" style={{ borderBottom: `1px solid ${T.border}` }}>
                        {kind === "metric" ? (
                          <select {...common} value={v} onChange={(e) => setCell(r.key, c, e.target.value)}>
                            {!OBJECTIVES.includes(v) && <option value={v}>{v || "—"}</option>}
                            {OBJECTIVES.map((o) => (
                              <option key={o} value={o}>
                                {o}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            {...common}
                            type={kind === "date" && (v === "" || ISO_RE.test(v)) ? "date" : "text"}
                            inputMode={kind === "number" || kind === "rate" ? "decimal" : undefined}
                            value={v}
                            title={bad ? (kind === "date" ? "Use YYYY-MM-DD" : "Must be a number, 0 or more") : undefined}
                            onChange={(e) => setCell(r.key, c, e.target.value)}
                          />
                        )}
                      </td>
                    );
                  })}
                  <td className="px-1.5 py-1 text-right" style={{ borderBottom: `1px solid ${T.border}` }}>
                    <button
                      type="button"
                      onClick={() => remove(r.key)}
                      aria-label="Remove row"
                      title="Remove row"
                      className="rounded px-2 py-0.5 text-sm font-bold"
                      style={{ color: T.warn, border: `1px solid ${T.warn}44`, background: T.surface }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: T.muted }}>
          {dirty ? (
            <>
              {counts.edited > 0 && <Chip tone="blue">{counts.edited} edited</Chip>}
              {counts.added > 0 && <Chip tone="good">{counts.added} added</Chip>}
              {counts.removed > 0 && <Chip tone="warn">{counts.removed} removed</Chip>}
            </>
          ) : (
            <span>No changes yet.</span>
          )}
          {errors > 0 && (
            <span style={{ color: T.warn, fontWeight: 700 }}>
              {errors} cell{errors === 1 ? "" : "s"} need fixing
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {dirty && (
            <button
              type="button"
              onClick={discard}
              className="rounded px-3 py-2 text-sm font-semibold"
              style={{ color: T.soft, border: `1px solid ${T.border}`, background: T.surface }}
            >
              Discard changes
            </button>
          )}
          <button
            type="button"
            onClick={validate}
            disabled={errors > 0}
            className="rounded px-4 py-2 text-sm font-bold"
            style={{ color: T.surface, background: errors > 0 ? T.muted : T.blue, cursor: errors > 0 ? "not-allowed" : "pointer" }}
          >
            Validate changes
          </button>
        </div>
      </div>
      <p className="text-xs" style={{ color: T.muted, lineHeight: 1.6 }}>
        Nothing changes on the dashboard until you validate, then choose Preview in this tab or
        Publish as Live below. Changed cells are outlined in blue, new rows tinted green.
      </p>
    </div>
  );
}
