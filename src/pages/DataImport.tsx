/* ===========================================================================
   /pages — DATA IMPORT
   Drop real CSV exports in, see exactly what they can and cannot support,
   then swap the dashboard onto them.

   The validation report is the point of this page, not the upload. A PMM
   handing an export to this screen should learn, before anything renders,
   whether there is enough history for a seasonal baseline, which metrics are
   absent, and whether campaign reach exists — rather than discovering it from
   a dashboard full of empty states.

   Preview keeps files in the browser: nothing is uploaded, committed, or
   deployed, which matters because this repository is public. Publishing is
   the one deliberate exception — it sends the parsed exports to the private
   store behind /api/live, gated by the publish password, and never to the repo.
=========================================================================== */
import { useState } from "react";
import { T } from "../theme/tokens";
import { Card, Chip } from "../components/primitives";
import { useDataSource } from "../state/dataStore";
import { TABLES, templateFor, type TableSpec } from "../data/file/schema";
import {
  buildFileSource,
  HISTORY_NEEDED,
  type ValidationReport,
  type Severity,
  type InputFiles,
} from "../data/file/load";
import { DAILY_FACTS, CAMPAIGNS_TABLE, CAMPAIGN_REACH, RELEASES_TABLE } from "../data/file/schema";
import { saveImport } from "../data/file/persist";
import { publishLive } from "../data/live";
import { fmtShort } from "../lib/dates";
import { usageFromMarkdown, campaignsFromWorkbook } from "../data/file/edwin";
import { int } from "../analytics/format";
import { Collapsible } from "../components/Collapsible";
import { ManualEditor } from "../components/ManualEditor";
import { METRIC_LABEL } from "../analytics/constants";

const TONE: Record<Severity, { color: string; label: string }> = {
  error: { color: T.warn, label: "Blocking" },
  warning: { color: "#B7791F", label: "Limitation" },
  info: { color: T.soft, label: "Note" },
};

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function TableCard({ spec, file, onPick }: { spec: TableSpec; file?: File; onPick: (f?: File) => void }) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <code className="text-sm font-bold" style={{ color: T.navy }}>
            {spec.file}
          </code>
          <Chip tone={spec.required ? "warn" : "muted"}>{spec.required ? "Required" : "Optional"}</Chip>
          {file && <Chip tone="good">{file.name}</Chip>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => download(spec.file, templateFor(spec))}
            className="rounded px-2 py-1 text-xs font-semibold"
            style={{ color: T.blue, border: `1px solid ${T.blue}55`, background: T.surface }}
          >
            Download template
          </button>
          <label
            className="rounded px-2 py-1 text-xs font-semibold cursor-pointer"
            style={{ color: T.surface, background: T.blue }}
          >
            Choose file
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => onPick(e.target.files?.[0])}
            />
          </label>
        </div>
      </div>
      <p className="mt-2 text-xs" style={{ color: T.soft, lineHeight: 1.6 }}>
        <b style={{ color: T.ink }}>{spec.grain}</b> {spec.purpose}
      </p>
      <details className="mt-2">
        <summary className="text-xs cursor-pointer" style={{ color: T.blue }}>
          {spec.columns.length} columns
        </summary>
        <ul className="mt-2 flex flex-col gap-1.5">
          {spec.columns.map((c) => (
            <li key={c.name} className="text-xs" style={{ color: T.soft, lineHeight: 1.5 }}>
              <code style={{ color: T.ink, fontWeight: 700 }}>{c.name}</code>
              {!c.required && <span style={{ color: T.muted }}> · optional</span>} — {c.why}
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}

function Report({ report, raw }: { report: ValidationReport; raw: InputFiles | null }) {
  const s = report.summary;
  const preview = useDataSource((x) => x.preview);
  const toLive = useDataSource((x) => x.toLive);
  const [swapped, setSwapped] = useState(false);
  const [persistWarning, setPersistWarning] = useState<string | null>(null);
  const [adminPw, setAdminPw] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<{ ok: boolean; message: string } | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-extrabold uppercase" style={{ color: T.navy, letterSpacing: "0.07em" }}>
            Validation report
          </h2>
          <Chip tone={report.usable ? (s.canAdjust ? "good" : "warn") : "warn"}>
            {!report.usable
              ? "Cannot load"
              : s.canAdjust
              ? "Ready — seasonal adjustment available"
              : "Loads, but no seasonal baseline"}
          </Chip>
        </div>

        {report.usable && (
          <div
            className="mt-4 grid gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}
          >
            {[
              ["Rows", int(s.rows)],
              ["Date range", s.dateFrom && s.dateTo ? `${fmtShort(s.dateFrom)} → ${fmtShort(s.dateTo)}` : "—"],
              ["History", `${int(s.historyDays)} days`],
              ["Segments", int(s.cells)],
              ["Campaigns", int(s.campaigns)],
              ["Missing days", int(s.missingDates)],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="text-xs uppercase" style={{ color: T.muted, letterSpacing: "0.06em" }}>
                  {k}
                </div>
                <div className="text-lg font-extrabold" style={{ color: T.ink }}>
                  {v}
                </div>
              </div>
            ))}
          </div>
        )}

        {report.usable && !s.canAdjust && (
          <div
            className="mt-4 rounded p-3 text-xs"
            style={{ border: `1px solid ${T.warn}55`, background: `${T.warn}0D`, lineHeight: 1.6 }}
          >
            <b style={{ color: T.warn }}>No seasonal baseline.</b> The dashboard compares each period
            against the same calendar window a year earlier, so it needs {HISTORY_NEEDED} days of
            history and this file has {int(s.historyDays)}. It will load, but every seasonally-adjusted
            figure will report no baseline and you will see raw levels only — which for K-12 data means
            September will look like a triumph and July like a collapse, regardless of what marketing
            did. Getting the full history is the highest-value thing to ask for.
          </div>
        )}

        {report.usable && s.metricsMissing.length > 0 && (
          <p className="mt-3 text-xs" style={{ color: T.soft, lineHeight: 1.6 }}>
            <b style={{ color: T.ink }}>Metrics unavailable:</b>{" "}
            {s.metricsMissing
              .map((m) => METRIC_LABEL[m as keyof typeof METRIC_LABEL] ?? m)
              .join(", ")}
            . Views that depend on them will show a not-tracked state rather than a zero.
          </p>
        )}
      </Card>

      {report.findings.length > 0 && (
        <Card className="p-5">
          <h3 className="text-xs font-extrabold uppercase" style={{ color: T.navy, letterSpacing: "0.06em" }}>
            {report.findings.length} finding{report.findings.length === 1 ? "" : "s"}
          </h3>
          <ul className="mt-3 flex flex-col gap-3">
            {report.findings.map((f, i) => (
              <li key={i} style={{ borderLeft: `3px solid ${TONE[f.severity].color}`, paddingLeft: 10 }}>
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-bold uppercase"
                    style={{ color: TONE[f.severity].color, letterSpacing: "0.05em" }}
                  >
                    {TONE[f.severity].label}
                  </span>
                  <code className="text-xs" style={{ color: T.muted }}>
                    {f.file}
                  </code>
                </div>
                <div className="text-sm font-semibold mt-0.5" style={{ color: T.ink, lineHeight: 1.45 }}>
                  {f.message}
                </div>
                {f.action && (
                  <div className="text-xs mt-0.5" style={{ color: T.soft, lineHeight: 1.55 }}>
                    {f.action}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {report.usable && report.source && (
        <Card className="p-5">
          <h3 className="text-xs font-extrabold uppercase" style={{ color: T.navy, letterSpacing: "0.06em" }}>
            Preview in this tab
          </h3>
          <button
            onClick={() => {
              preview(report.source!);
              setSwapped(true);
              if (raw) {
                const r = saveImport(raw);
                setPersistWarning(r.ok ? null : r.reason ?? null);
              }
            }}
            className="mt-2 rounded px-4 py-2 text-sm font-bold"
            style={{ color: T.surface, background: swapped ? T.good : T.blue }}
          >
            {swapped ? "Previewing this data" : "Preview in this tab"}
          </button>
          <p className="mt-2 text-xs" style={{ color: T.soft, lineHeight: 1.6 }}>
            Replaces the dashboard's data in this tab only. Nothing is uploaded, and choosing Sample
            or Live in the rail leaves the preview. The gate thresholds (minimum sample and activity
            volume) were calibrated against synthetic magnitudes, so expect to re-tune them against
            the real noise floor before trusting any verdict.
          </p>
          {persistWarning && (
            <p className="mt-2 text-xs" style={{ color: T.warn, lineHeight: 1.6 }}>
              {persistWarning}
            </p>
          )}

          {raw && (
            <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${T.border}` }}>
              <h3 className="text-xs font-extrabold uppercase" style={{ color: T.navy, letterSpacing: "0.06em" }}>
                Publish as Live
              </h3>
              <p className="mt-1 text-xs" style={{ color: T.soft, lineHeight: 1.6 }}>
                Replaces what Live shows for everyone with the Live password. The data goes to a
                private store on the dashboard's host — never to the public repository.
              </p>
              <form
                className="mt-2 flex flex-wrap items-center gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!adminPw || publishing) return;
                  setPublishing(true);
                  setPublished(null);
                  const r = await publishLive(raw, adminPw);
                  setPublishing(false);
                  if (!r.ok) {
                    setPublished({ ok: false, message: r.message });
                    return;
                  }
                  setAdminPw("");
                  setPublished({
                    ok: true,
                    message: `Published ${fmtShort(r.publishedAt.slice(0, 10))}. The dashboard is now on Live.`,
                  });
                  void toLive();
                }}
              >
                <input
                  type="password"
                  value={adminPw}
                  onChange={(e) => setAdminPw(e.target.value)}
                  aria-label="Publish password"
                  placeholder="Publish password"
                  autoComplete="off"
                  className="rounded px-2 py-1 text-sm"
                  style={{ border: `1px solid ${T.border}`, color: T.ink, background: T.surface }}
                />
                <button
                  type="submit"
                  disabled={!adminPw || publishing}
                  className="rounded px-4 py-2 text-sm font-bold"
                  style={{
                    color: T.surface,
                    background: adminPw && !publishing ? T.navy : T.muted,
                    cursor: adminPw && !publishing ? "pointer" : "not-allowed",
                  }}
                >
                  {publishing ? "Publishing…" : "Publish as Live"}
                </button>
              </form>
              {published && (
                <p className="mt-2 text-xs" style={{ color: published.ok ? T.good : T.warn, lineHeight: 1.6 }}>
                  {published.message}
                </p>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

/* The two exports Product Marketing already keeps, loaded in the shape they
   are actually kept in. Re-keying them into CSV every month is a step that
   would eventually be skipped, and both formats are unambiguous enough to
   read directly. */
function EdwinImport({
  onReport,
}: {
  onReport: (report: ValidationReport, raw: InputFiles) => void;
}) {
  const [usage, setUsage] = useState<File | undefined>();
  const [book, setBook] = useState<File | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const parsedUsage = usage ? usageFromMarkdown(await usage.text()) : null;
      if (usage && !parsedUsage) {
        setError(
          "No weekly table found in that file. It needs a markdown table with a week-start column and a weekly engaged/active teacher column."
        );
        return;
      }
      const parsedCamp = book ? await campaignsFromWorkbook(await book.arrayBuffer()) : null;

      const input: InputFiles = {
        dailyFacts: parsedUsage ? "edwin" : undefined,
        campaigns: parsedCamp ? "edwin" : undefined,
        parsed: {
          facts: parsedUsage?.rows,
          campaigns: parsedCamp?.campaigns,
        },
        label: "Edwin export",
      };
      onReport(buildFileSource(input), input);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read those files.");
    } finally {
      setBusy(false);
    }
  };

  const ready = !!usage && !!book;

  return (
    <div>
      <p className="text-xs" style={{ color: T.soft, lineHeight: 1.6 }}>
        Takes the two files as they are: the weekly usage rollup as a markdown table, and the
        Pardot / YesWare / in-app workbook as .xlsx.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        {[
          {
            label: "Weekly usage rollup",
            hint: "Edwin Metrics — markdown table with Week Starting and Weekly Engaged Teachers",
            accept: ".md,.markdown,.txt,.csv",
            file: usage,
            set: setUsage,
          },
          {
            label: "Campaign workbook",
            hint: "Marketing Communications Metrics — Pardot, YesWare and in-app notification sheets",
            accept: ".xlsx",
            file: book,
            set: setBook,
          },
        ].map((f) => (
          <div key={f.label} className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold" style={{ color: T.ink }}>
                {f.label} {f.file && <Chip tone="good">{f.file.name}</Chip>}
              </div>
              <div className="text-xs" style={{ color: T.muted }}>
                {f.hint}
              </div>
            </div>
            <label
              className="rounded px-2 py-1 text-xs font-semibold cursor-pointer shrink-0"
              style={{ color: T.surface, background: T.blue }}
            >
              Choose file
              <input
                type="file"
                accept={f.accept}
                className="hidden"
                onChange={(e) => f.set(e.target.files?.[0])}
              />
            </label>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          disabled={!ready || busy}
          onClick={run}
          className="rounded px-4 py-2 text-sm font-bold"
          style={{
            color: T.surface,
            background: ready && !busy ? T.blue : T.muted,
            cursor: ready && !busy ? "pointer" : "not-allowed",
          }}
        >
          {busy ? "Reading…" : "Load and validate"}
        </button>
        {!ready && (
          <span className="text-xs" style={{ color: T.muted }}>
            Both files are needed.
          </span>
        )}
      </div>
      {error && (
        <p className="mt-2 text-xs" style={{ color: T.warn, lineHeight: 1.6 }}>
          {error}
        </p>
      )}
    </div>
  );
}

export default function DataImport() {
  const [files, setFiles] = useState<Record<string, File | undefined>>({});
  const [report, setReport] = useState<ValidationReport | null>(null);
  // Keep the raw text so a successful import can be persisted for the session.
  const [raw, setRaw] = useState<InputFiles | null>(null);
  const [busy, setBusy] = useState(false);
  const { label, mode, live, toSample } = useDataSource();
  const [origin, setOrigin] = useState("");
  // Remounts the report for each new result, so its Preview / Publish state
  // never carries over from the previous one.
  const [reportKey, setReportKey] = useState(0);
  const showReport = (r: ValidationReport, input: InputFiles, from: string) => {
    setReport(r);
    setRaw(input);
    setOrigin(from);
    setReportKey((k) => k + 1);
    requestAnimationFrame(() => document.getElementById("validation-report")?.scrollIntoView({ behavior: "smooth" }));
  };

  const ready = TABLES.filter((t) => t.required).every((t) => files[t.file]);

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <h2 className="text-sm font-extrabold uppercase" style={{ color: T.navy, letterSpacing: "0.07em" }}>
          Current source
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="text-lg font-extrabold" style={{ color: T.ink }}>
            {/* The synthetic source sits underneath an unloaded Live; never name it as Live's. */}
            {mode === "live" && live.status !== "ready" ? "No live data loaded" : label}
          </span>
          <Chip tone={mode === "sample" ? "muted" : mode === "live" ? "good" : "warn"}>
            {mode === "sample"
              ? "Sample"
              : mode === "preview"
              ? "Preview — unpublished"
              : live.status === "ready"
              ? `Live${live.publishedAt ? ` · published ${fmtShort(live.publishedAt.slice(0, 10))}` : ""}`
              : "Live — not loaded"}
          </Chip>
          {mode !== "sample" && (
            <button
              onClick={() => {
                toSample();
                setReport(null);
                setRaw(null);
                setFiles({});
              }}
              className="rounded px-2 py-1 text-xs font-semibold"
              style={{ color: T.blue, border: `1px solid ${T.blue}55`, background: T.surface }}
            >
              Switch to Sample
            </button>
          )}
        </div>
        {mode === "live" && live.status !== "ready" && live.message && (
          <p className="mt-2 text-xs" style={{ color: T.warn, lineHeight: 1.6 }}>
            {live.message}
          </p>
        )}
        <p className="mt-2 text-xs" style={{ color: T.soft, lineHeight: 1.6 }}>
          Files are read in your browser. <b style={{ color: T.ink }}>Preview</b> keeps them in this
          tab's session storage — nothing is uploaded, it survives a reload, and it is discarded when
          you close the tab. <b style={{ color: T.ink }}>Publish as Live</b> sends the parsed exports
          to a private, password-protected store so anyone with the Live password sees them. Neither
          ever touches this repository, which is public, so real Edwin numbers must not be committed
          to it.
        </p>
      </Card>

      <h2 className="mt-2 text-xs font-bold uppercase" style={{ color: T.muted, letterSpacing: "0.08em" }}>
        Get data in — choose one
      </h2>

      <Collapsible
        title="Load your Edwin exports"
        summary="The weekly usage .md and the campaign .xlsx, exactly as you keep them."
        badge={<Chip tone="blue">No conversion needed</Chip>}
        defaultOpen
      >
        <EdwinImport onReport={(r, input) => showReport(r, input, "your Edwin exports")} />
      </Collapsible>

      <Collapsible
        title="Manual data"
        summary="Change, add or remove weekly usage, campaigns and releases by hand — no file needed."
        badge={<Chip tone="muted">Starts from Live</Chip>}
      >
        <ManualEditor onReport={(r, input) => showReport(r, input, "manual edits")} />
      </Collapsible>

      <Collapsible
        title="Load generic CSV"
        summary="For a segmented export from Power BI, in the column contract below. Templates included."
        badge={<Chip tone="muted">4 files · 2 required</Chip>}
      >
        <div className="flex flex-col gap-3">
          {TABLES.map((t) => (
            <TableCard
              key={t.file}
              spec={t}
              file={files[t.file]}
              onPick={(f) => {
                setFiles((prev) => ({ ...prev, [t.file]: f }));
                setReport(null);
              }}
            />
          ))}

          <div className="flex items-center gap-3">
            <button
              disabled={!ready || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const read = async (f?: File) => (f ? await f.text() : undefined);
                  const input: InputFiles = {
                    dailyFacts: await read(files[DAILY_FACTS.file]),
                    campaigns: await read(files[CAMPAIGNS_TABLE.file]),
                    reach: await read(files[CAMPAIGN_REACH.file]),
                    releases: await read(files[RELEASES_TABLE.file]),
                    label: "Imported CSV",
                  };
                  showReport(buildFileSource(input), input, "generic CSV");
                } finally {
                  setBusy(false);
                }
              }}
              className="rounded px-4 py-2 text-sm font-bold"
              style={{
                color: T.surface,
                background: ready && !busy ? T.blue : T.muted,
                cursor: ready && !busy ? "pointer" : "not-allowed",
              }}
            >
              {busy ? "Validating…" : "Validate"}
            </button>
            {!ready && (
              <span className="text-xs" style={{ color: T.muted }}>
                daily_facts.csv and campaigns.csv are both required.
              </span>
            )}
          </div>

        </div>
      </Collapsible>

      {report && (
        <div id="validation-report" className="flex flex-col gap-2" style={{ scrollMarginTop: 16 }}>
          <div className="text-xs font-bold uppercase" style={{ color: T.muted, letterSpacing: "0.08em" }}>
            Result · from {origin}
          </div>
          <Report key={reportKey} report={report} raw={raw} />
        </div>
      )}
    </div>
  );
}
