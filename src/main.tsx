import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { readImport } from "./data/file/persist";
import { buildFileSource } from "./data/file/load";
import { useDataSource, storedMode } from "./state/dataStore";

/* Restore an unpublished preview from this tab's session before the first
   render. sessionStorage is synchronous, so this costs a re-parse and no async
   boot. Any failure falls through silently — a corrupt stored payload must
   never stop the app from starting.

   Without a preview, the browser's last Sample / Live choice applies. Live is
   fetched after the first render; until it lands, the Layout's gate stands in
   for every page so the synthetic default is never shown as Live. */
let restored = false;
const stored = readImport();
if (stored) {
  try {
    const report = buildFileSource(stored);
    if (report.usable && report.source) {
      useDataSource.getState().preview(report.source);
      restored = true;
    }
  } catch {
    /* keep the synthetic default */
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if (!restored && storedMode() === "live") void useDataSource.getState().toLive();
