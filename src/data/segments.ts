/* ===========================================================================
   /data — SEGMENT CELLS
   The cross-product of province × grade × subject. Every daily fact is
   generated per cell so the analytics layer can filter to any segment.
=========================================================================== */
import type { Cell } from "./schema";

export const PROVINCES = [
  { k: "ON", w: 0.71, e: 1.04 },
  { k: "AB", w: 0.29, e: 0.93 },
];
export const GRADES = [
  { k: "Primary (1–3)", w: 0.3, e: 1.06 },
  { k: "Junior/Intermediate (4–8)", w: 0.38, e: 1.02 },
  { k: "Secondary (9–12)", w: 0.32, e: 0.89 },
];
export const SUBJECTS = [
  { k: "Mathematics", w: 0.3, e: 1.05 },
  { k: "English/ELA", w: 0.28, e: 1.0 },
  { k: "Science", w: 0.22, e: 0.96 },
  { k: "Social Studies", w: 0.2, e: 0.92 },
];

export const CELLS: Cell[] = [];
PROVINCES.forEach((p) =>
  GRADES.forEach((g) =>
    SUBJECTS.forEach((s) => {
      CELLS.push({
        id: CELLS.length,
        province: p.k,
        grade: g.k,
        subject: s.k,
        weight: p.w * g.w * s.w,
        engagement: p.e * g.e * s.e,
      });
    })
  )
);
