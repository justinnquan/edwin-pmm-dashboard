/* ===========================================================================
   /components — LEFT NAVIGATION RAIL (routed)
   Phia side-nav: 240px, off-white canvas, blue edwin logotype, icon + label
   items, the selected item on a pale blue fill.
=========================================================================== */
import { NavLink } from "react-router-dom";
import { T, eyebrow } from "../theme/tokens";
import { NAV } from "./nav";
import { SourceToggle } from "./SourceToggle";
import { Icon } from "./Icon";
import { EdwinLogo } from "./EdwinLogo";

export function Rail() {
  return (
    <nav
      className="hidden lg:flex flex-col shrink-0"
      style={{
        width: 240,
        background: T.bg,
        borderRight: `1px solid ${T.border}`,
        position: "sticky",
        top: 0,
        height: "100vh",
        padding: "24px 16px",
        gap: 24,
      }}
    >
      <div className="px-2">
        <EdwinLogo height={28} />
        <div className="mt-2 text-sm font-semibold" style={{ color: T.muted }}>
          Product Marketing
        </div>
      </div>
      <div className="flex flex-col gap-0.5 flex-1 overflow-y-auto">
        {NAV.map((n) => (
          <NavLink
            key={n.path}
            to={n.path}
            end={n.path === "/"}
            className={({ isActive }) => "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm" + (isActive ? "" : " phia-nav")}
            style={({ isActive }) => ({
              color: isActive ? T.blue : T.soft,
              fontWeight: isActive ? 700 : 600,
              background: isActive ? T.blue100 : "transparent",
              textDecoration: "none",
            })}
          >
            {n.icon && <Icon name={n.icon} size={18} />}
            <span>{n.label}</span>
            {n.phase && (
              <span className="ml-auto text-xs" style={{ color: T.muted }}>
                {n.phase}
              </span>
            )}
          </NavLink>
        ))}
      </div>
      <div
        className="rounded-lg p-3"
        style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadowXs }}
      >
        <div className="mb-2" style={eyebrow}>
          Data
        </div>
        <SourceToggle />
        <div className="mt-3 text-xs" style={{ color: T.muted, fontFamily: T.fontUI }}>
          v{__APP_VERSION__}
        </div>
      </div>
    </nav>
  );
}
