/* ===========================================================================
   /components — LEFT NAVIGATION RAIL (routed)
=========================================================================== */
import { NavLink } from "react-router-dom";
import { T } from "../theme/tokens";
import { NAV } from "./nav";

export function Rail() {
  return (
    <nav className="hidden lg:flex flex-col shrink-0" style={{ width: 226, background: T.railTint }}>
      <div className="px-5 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,.10)" }}>
        <div className="text-sm font-extrabold tracking-wide" style={{ color: "#fff" }}>
          NELSON <span style={{ color: T.blue }}>edwin</span>
        </div>
        <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,.55)" }}>
          Product Marketing
        </div>
      </div>
      <div className="py-3">
        {NAV.map((n) => (
          <NavLink
            key={n.path}
            to={n.path}
            end={n.path === "/"}
            className="block px-5 py-2 text-sm"
            style={({ isActive }) => ({
              color: isActive ? "#fff" : "rgba(255,255,255,.55)",
              fontWeight: isActive ? 700 : 500,
              borderLeft: isActive ? `3px solid ${T.blue}` : "3px solid transparent",
              background: isActive ? "rgba(255,255,255,.06)" : "transparent",
              textDecoration: "none",
            })}
          >
            {n.label}
            {n.phase && (
              <span className="ml-2 text-xs" style={{ color: "rgba(255,255,255,.30)" }}>
                {n.phase}
              </span>
            )}
          </NavLink>
        ))}
      </div>
      <div
        className="mt-auto px-5 py-4 text-xs"
        style={{ color: "rgba(255,255,255,.35)", lineHeight: 1.6 }}
      >
        Prototype · synthetic data
        <br />
        Phases C–G of 7
      </div>
    </nav>
  );
}
