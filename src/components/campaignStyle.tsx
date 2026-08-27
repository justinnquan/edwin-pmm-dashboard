/* ===========================================================================
   /components — CAMPAIGN-TYPE STYLING (shared by Timeline + Calendar)
   One colour per campaign type, plus a legend. Presentation only.
=========================================================================== */
import { CAMPAIGNS } from "../data/campaigns";
import { T } from "../theme/tokens";

export const TYPE_COLORS: Record<string, string> = {
  "Product/feature launch": "#017ACC",
  "Pardot email": "#003865",
  "Re-engagement": "#E8633A",
  "Release notes": "#1F8A70",
  "In-app notification": "#7A5CC0",
};

export const typeColor = (type: string): string => TYPE_COLORS[type] ?? T.muted;

export const RELEASE_COLOR = T.navy;

/** Campaign types actually present, in first-seen order. */
export const CAMPAIGN_TYPES: string[] = Array.from(new Set(CAMPAIGNS.map((c) => c.type)));

export function CampaignTypeLegend({ withRelease = true }: { withRelease?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: T.soft }}>
      {CAMPAIGN_TYPES.map((t) => (
        <span key={t} className="flex items-center gap-2">
          <span
            style={{ width: 10, height: 10, borderRadius: 2, background: typeColor(t), display: "inline-block" }}
          />
          {t}
        </span>
      ))}
      {withRelease && (
        <span className="flex items-center gap-2">
          <span
            style={{
              width: 9,
              height: 9,
              background: RELEASE_COLOR,
              display: "inline-block",
              transform: "rotate(45deg)",
            }}
          />
          Product release
        </span>
      )}
    </div>
  );
}
