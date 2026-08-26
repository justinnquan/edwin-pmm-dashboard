/* ===========================================================================
   /components — LEFT NAVIGATION RAIL
=========================================================================== */
import { T } from "../theme/tokens";

export function Rail({ active }: { active: string }) {
  const items = [
    "Executive Overview",
    "Marketing Performance",
    "Activity Timeline",
    "Campaign Impact",
    "Adoption & Engagement",
    "Segments",
    "Campaign Calendar",
  ];
  return (
    <nav
      className="hidden lg:flex flex-col shrink-0"
      style={{ width: 226, background: T.railTint }}
    >
      <div className="px-5 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,.10)" }}>
        <div className="text-sm font-extrabold tracking-wide" style={{ color: "#fff" }}>
          NELSON <span style={{ color: T.blue }}>edwin</span>
        </div>
        <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,.55)" }}>
          Product Marketing
        </div>
      </div>
      <div className="py-3">
        {items.map((n) => {
          const on = n === active;
          return (
            <div
              key={n}
              className="px-5 py-2 text-sm"
              style={{
                color: on ? "#fff" : "rgba(255,255,255,.55)",
                fontWeight: on ? 700 : 500,
                borderLeft: on ? `3px solid ${T.blue}` : "3px solid transparent",
                background: on ? "rgba(255,255,255,.06)" : "transparent",
              }}
            >
              {n}
              {!on && (
                <span className="ml-2 text-xs" style={{ color: "rgba(255,255,255,.30)" }}>
                  ·
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div
        className="mt-auto px-5 py-4 text-xs"
        style={{ color: "rgba(255,255,255,.35)", lineHeight: 1.6 }}
      >
        Prototype · synthetic data
        <br />
        Phase C of 7
      </div>
    </nav>
  );
}
