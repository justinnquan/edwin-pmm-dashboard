/* ===========================================================================
   /components — CAMPAIGN-TYPE STYLING (shared by Timeline + Calendar)
   One colour per campaign type, plus a legend. Presentation only.
=========================================================================== */
import { src } from "../data/source";
import { T } from "../theme/tokens";

/* Phia tones. Sample's types and the channel names the real exports use
   (Pardot, YesWare) both have a colour, so Live campaigns are not all grey. */
export const TYPE_COLORS: Record<string, string> = {
  "Product/feature launch": T.blue,
  "Pardot email": T.navy,
  "Re-engagement": T.warn,
  "Release notes": T.good,
  "In-app notification": T.logins,
  Pardot: T.blue,
  YesWare: T.logins,
};

export const typeColor = (type: string): string => TYPE_COLORS[type] ?? T.muted;

export const RELEASE_COLOR = T.navy;

/** Campaign types actually present, in first-seen order. */
export const campaignTypes = (): string[] =>
  Array.from(new Set(src().campaigns.map((c) => c.type)));

export function CampaignTypeLegend({ withRelease = true }: { withRelease?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: T.soft }}>
      {campaignTypes().map((t: string) => (
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
