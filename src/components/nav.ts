/* ===========================================================================
   /components — NAVIGATION CONFIG
   Single source of truth for the left rail and the top-bar title/subtitle.
=========================================================================== */
import type { IconName } from "./Icon";

export interface NavItem {
  label: string;
  path: string;
  title: string;
  subtitle: string;
  phase?: string; // set for sections not yet built
  icon?: IconName; // Phia line icon shown beside the label
}

export const NAV: NavItem[] = [
  {
    label: "Executive Overview",
    path: "/",
    icon: "dashboard",
    title: "Executive Overview",
    subtitle: "How is Edwin doing, and what is marketing contributing?",
  },
  {
    label: "Marketing Performance",
    path: "/marketing",
    icon: "notifications",
    title: "Marketing Performance",
    subtitle: "Every campaign, its channel engagement, and the product behaviour that followed.",
  },
  {
    label: "Activity Timeline",
    path: "/timeline",
    icon: "history",
    title: "Activity Timeline",
    subtitle: "Campaigns and product releases against the product metrics.",
  },
  {
    label: "Campaign Impact",
    path: "/campaign",
    icon: "star",
    title: "Campaign Impact",
    subtitle: "A single campaign's associated product impact, with honest caveats.",
  },
  {
    label: "Adoption & Engagement",
    path: "/adoption",
    icon: "heart",
    title: "Adoption & Engagement",
    subtitle: "The activation funnel and the Day-7 / monthly-active OKR gauges.",
  },
  {
    label: "Segments",
    path: "/segments",
    icon: "geography",
    title: "Segments",
    subtitle: "Where the opportunity is, by province, grade, and subject.",
  },
  {
    label: "Campaign Calendar",
    path: "/calendar",
    icon: "calendar",
    title: "Campaign Calendar",
    subtitle: "Campaigns and product events laid out on a calendar.",
  },
  {
    label: "Data Import",
    path: "/data",
    icon: "download-cloud",
    title: "Data Import",
    subtitle: "Load a real Edwin export and see exactly what it can support.",
  },
];

/** Longest-prefix match so /campaign/:id resolves to the Campaign Impact item. */
export function navFor(pathname: string): NavItem {
  const matches = NAV.filter(
    (n) => (n.path === "/" ? pathname === "/" : pathname.startsWith(n.path))
  ).sort((a, b) => b.path.length - a.path.length);
  return matches[0] ?? NAV[0];
}
