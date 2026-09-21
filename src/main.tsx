import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { setSource } from "./data/source";
import { readImport } from "./data/file/persist";
import { buildFileSource } from "./data/file/load";

/* Restore an imported CSV from this tab's session before the first render.
   sessionStorage is synchronous, so this costs a re-parse and no async boot.
   Any failure falls through silently to the synthetic default — a corrupt
   stored payload must never stop the app from starting. */
const stored = readImport();
if (stored) {
  try {
    const report = buildFileSource(stored);
    if (report.usable && report.source) setSource(report.source);
  } catch {
    /* keep the synthetic default */
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
