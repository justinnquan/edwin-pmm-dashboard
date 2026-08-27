/* ===========================================================================
   /components — NAVIGATION CONFIG
   Single source of truth for the left rail and the top-bar title/subtitle.
=========================================================================== */
export interface NavItem {
  label: string;
  path: string;
  title: string;
  subtitle: string;
  phase?: string; // set for sections not yet built
}

export const NAV: NavItem[] = [
  {
    label: "Executive Overview",
    path: "/",
    title: "Executive Overview",
    subtitle: "How is Edwin doing, and what is marketing contributing?",
  },
  {
    label: "Marketing Performance",
    path: "/marketing",
    title: "Marketing Performance",
    subtitle: "Every campaign, its channel engagement, and the product behaviour that followed.",
  },
  {
    label: "Activity Timeline",
    path: "/timeline",
    title: "Activity Timeline",
    subtitle: "Campaigns and product releases against the product metrics.",
  },
  {
    label: "Campaign Impact",
    path: "/campaign",
    title: "Campaign Impact",
    subtitle: "A single campaign's associated product impact, with honest caveats.",
  },
  {
    label: "Adoption & Engagement",
    path: "/adoption",
    title: "Adoption & Engagement",
    subtitle: "The activation funnel and the Day-7 / monthly-active OKR gauges.",
    phase: "Phase F",
  },
  {
    label: "Segments",
    path: "/segments",
    title: "Segments",
    subtitle: "Where the opportunity is, by province, grade, and subject.",
    phase: "Phase F",
  },
  {
    label: "Campaign Calendar",
    path: "/calendar",
    title: "Campaign Calendar",
    subtitle: "Campaigns and product events laid out on a calendar.",
  },
];

/** Longest-prefix match so /campaign/:id resolves to the Campaign Impact item. */
export function navFor(pathname: string): NavItem {
  const matches = NAV.filter(
    (n) => (n.path === "/" ? pathname === "/" : pathname.startsWith(n.path))
  ).sort((a, b) => b.path.length - a.path.length);
  return matches[0] ?? NAV[0];
}
