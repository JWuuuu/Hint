import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Search, ArrowRight } from "lucide-react";
import { AppScreen, ScreenHeader } from "../../components/app/AppChrome";
import { getModulesBySection } from "../home/data/modules";
import { useLanguage } from "../../lib/i18n";
import type { SectionKey } from "../home/types/home.types";

export function RoomsLibrary() {
  const { t, language } = useLanguage();

  const [filter, setFilter] = useState<SectionKey | "all">("all");
  const [query, setQuery] = useState("");
  const [includeUpcoming, setIncludeUpcoming] = useState(false);
  const groups = useMemo(() => getModulesBySection(), []);
  const translated = (id: string, part: "title" | "hint", fallback: string) => {
    const key = `module.${id}.${part}`;
    return t(key) === key ? fallback : t(key);
  };
  const visible = groups.filter(({ section }) => filter === "all" || section.key === filter).map(({ section, modules }) => ({ section, modules: modules.filter((module) => {
    if (!includeUpcoming && (!module.href || module.id === "dream")) return false;
    return `${translated(module.id, "title", module.title)} ${translated(module.id, "hint", module.hint)} ${t(`section.${section.key}.label`)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  }) })).filter((group) => group.modules.length);
  const count = visible.reduce((sum, group) => sum + group.modules.length, 0);

  return <AppScreen>
    <ScreenHeader title={t("rooms.title")} eyebrow={t("rooms.eyebrow")} subtitle={t("rooms.subtitle")} backHref="/app" />
    <label className="mb-3 flex min-h-12 items-center gap-3 rounded-[16px] border px-4" style={{ background: "var(--hint-input-bg)", borderColor: "var(--hint-border)", color: "var(--hint-text)" }}>
      <Search size={18} aria-hidden className="shrink-0" />
      <input type="search" aria-label={t("quality.searchRooms")} placeholder={t("quality.searchRooms")} value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-12 min-w-0 w-full bg-transparent text-[16px] outline-none" />
    </label>
    <nav aria-label={t("quality.roomCategories")} className="mb-3 flex flex-wrap gap-2">
      {([{ key: "all", label: t("quality.allRooms") }, ...groups.map(({ section }) => ({ key: section.key, label: t(`section.${section.key}.label`) }))]).map((item) => <button key={item.key} type="button" aria-pressed={filter === item.key} onClick={() => setFilter(item.key as SectionKey | "all")} className="min-h-11 rounded-full border px-3 text-[12px]" style={{ borderColor: filter === item.key ? "var(--hint-aqua)" : "var(--hint-border)", background: filter === item.key ? "var(--hint-surface-strong)" : "var(--hint-surface-soft)", color: "var(--hint-text)" }}>{item.label}</button>)}
    </nav>
    <label className="mb-4 flex min-h-11 items-center gap-3 text-[13px]" style={{ color: "var(--hint-muted)" }}><input type="checkbox" checked={includeUpcoming} onChange={(event) => setIncludeUpcoming(event.target.checked)} />{t("quality.includePreviews")}</label>
    <p role="status" className="mb-4 text-[12px]" style={{ color: "var(--hint-muted)" }}>{t("quality.roomCount").replace("{count}", count.toLocaleString(language))}</p>
    {!count ? <div className="rounded-[20px] border p-5" style={{ borderColor: "var(--hint-border)", color: "var(--hint-text)" }}><h2 className="font-serif text-[24px]">{t("quality.noRooms")}</h2><p className="mt-2 text-[13px]">{t("quality.noRoomsHint")}</p><button type="button" onClick={() => { setQuery(""); setFilter("all"); }} className="mt-3 min-h-11 underline">{t("quality.resetFilters")}</button></div> : null}
    <div className="grid gap-6">{visible.map(({ section, modules }) => <section key={section.key}>
      <h2 className="mb-3 font-serif text-[24px]" style={{ color: "var(--hint-text)" }}>{t(`section.${section.key}.label`)}</h2>
      <div className="grid grid-cols-2 gap-3">{modules.map((module) => {
        const Sigil = module.sigil;
        const content = <><div className="mb-4 flex items-start justify-between gap-2"><span className="block size-7 shrink-0" style={{ color: "var(--hint-aqua)" }}><Sigil /></span>{module.id === "dream" || !module.href ? <span className="text-[10px]" style={{ color: "var(--hint-muted)" }}>{module.href ? t("quality.preview") : t("quality.upcoming")}</span> : <ArrowRight size={16} aria-hidden />}</div><h3 className="break-words font-serif text-[21px] leading-tight">{translated(module.id, "title", module.title)}</h3><p className="mt-2 text-[12px] leading-relaxed" style={{ color: "var(--hint-muted)" }}>{translated(module.id, "hint", module.hint)}</p></>;
        const style = { background: "var(--hint-surface-soft)", borderColor: "var(--hint-border)", color: "var(--hint-text)" };
        return module.href ? <Link key={module.id} href={module.href} className="min-w-0 rounded-[20px] border p-4" style={style}>{content}</Link> : <div key={module.id} className="min-w-0 rounded-[20px] border p-4" style={style}>{content}</div>;
      })}</div>
    </section>)}</div>
  </AppScreen>;
}
