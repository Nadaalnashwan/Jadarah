import { getI18n } from "@/lib/i18n/server";
import { NAV_GROUPS, type NavGroup } from "@/lib/nav-groups";
import { SectionTabs } from "./section-tabs";

/** Server wrapper: renders the tabs of a navigation group in the current language. */
export async function GroupTabs({ group }: { group: NavGroup }) {
  const { locale } = await getI18n();
  const g = NAV_GROUPS[group];
  const pick = (p: [string, string]) => (locale === "ar" ? p[1] : p[0]);
  return (
    <SectionTabs label={pick(g.label)} items={g.tabs.map((t) => ({ href: t.href, label: pick(t.label) }))} />
  );
}
