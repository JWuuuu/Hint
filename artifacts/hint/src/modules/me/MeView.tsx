import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, BookOpen, Layers3, Orbit } from "lucide-react";
import { Link } from "wouter";
import { AppScreen, SpaceNavigation } from "../../components/app/AppChrome";
import { useProfile } from "../../lib/useProfile";
import { ProfileForm } from "../../components/app/ProfileForm";
import { ProfileCard } from "./components/ProfileCard";
import { SettingsList } from "./components/SettingsList";
import { useLanguage } from "../../lib/i18n";
import { useMotionPolicy } from "../../lib/motionPolicy";
import { LocalProfileSwitcher } from "../../components/app/LocalProfileSwitcher";
import { DeviceConnectionStatus } from "../../components/app/DeviceConnectionStatus";
import { ME_COPY } from "./meCopy";
import "./me.css";

/** A personal home, with everyday choices separated from device/data management. */
export function MeView() {
  const { profile, saveProfile, isSaving, storageStatus } = useProfile();
  const [editing, setEditing] = useState(false);
  const { language, t } = useLanguage();
  const copy = ME_COPY[language];
  const { reduced, pageVisible } = useMotionPolicy();
  const container = useRef<HTMLDivElement>(null);
  const wasEditing = useRef(false);
  const editSession = useRef(0);
  const editRevision = useRef(0);

  useEffect(() => {
    if (editing) {
      container.current?.querySelector<HTMLElement>("#me-edit-heading")?.focus();
      container.current?.closest(".hint-app-scroll")?.scrollTo?.({ top: 0, behavior: "instant" });
    } else if (wasEditing.current) {
      container.current?.querySelector<HTMLElement>('[data-testid="button-edit-profile"]')?.focus();
    }
    wasEditing.current = editing;
  }, [editing]);

  function beginEditing() {
    editSession.current += 1;
    editRevision.current = 0;
    setEditing(true);
  }

  function finishEditing() {
    editSession.current += 1;
    setEditing(false);
  }

  async function handleSave(input: Parameters<typeof saveProfile>[0]) {
    const session = editSession.current;
    const revision = editRevision.current;
    await saveProfile(input);
    // The saved version must not dismiss a reopened editor or newer unsaved text.
    if (session === editSession.current && revision === editRevision.current) finishEditing();
  }

  const spaces = [
    { id: "chart", icon: Orbit, title: copy.chart, detail: copy.chartDetail, href: "/app/astrology?tab=chart" },
    { id: "history", icon: BookOpen, title: copy.history, detail: copy.historyDetail, href: "/app/readings" },
    { id: "collection", icon: Layers3, title: copy.collection, detail: copy.collectionDetail, href: "/app/collection" },
  ];

  return <AppScreen>
    <div ref={container} className="me-page" data-reduced-motion={reduced} data-motion-paused={!pageVisible}>
      {editing ? <section className="me-edit-page" aria-labelledby="me-edit-heading">
        <button type="button" onClick={finishEditing} className="me-back"><ArrowLeft size={17} aria-hidden="true" />{copy.back}</button>
        <header className="me-heading"><p className="me-eyebrow">{copy.localProfile}</p><h1 id="me-edit-heading" tabIndex={-1}>{t("me.editProfile")}</h1><p>{copy.editIntro}</p></header>
        <div className="me-surface me-form" onChangeCapture={() => { editRevision.current += 1; }}><ProfileForm initial={profile} submitLabel={t("me.saveChanges")} onSubmit={handleSave} isSaving={isSaving} onCancel={finishEditing} /></div>
      </section> : <>
        <SpaceNavigation />
        <header className="me-heading"><p className="me-eyebrow">Hint / {t("nav.me")}</p><h1>{copy.title}</h1><p>{copy.subtitle}</p></header>
        <ProfileCard profile={profile} onEdit={beginEditing} storageStatus={storageStatus} />
        <section className="me-section" aria-labelledby="me-personal-heading">
          <div className="me-section-heading"><h2 id="me-personal-heading">{copy.personalSpace}</h2><span aria-hidden="true">✦</span></div>
          <div className="me-personal-links me-surface">{spaces.map(({ id, icon: Icon, title, detail, href }) => <Link key={id} href={href} className="me-personal-link" data-space={id}>
            <span className="me-space-icon" aria-hidden="true"><Icon size={22} strokeWidth={1.2} /></span>
            <span className="me-link-copy"><strong>{title}</strong><span>{detail}</span></span><ArrowUpRight size={17} className="me-link-arrow" aria-hidden="true" />
          </Link>)}</div>
        </section>
        <div id="me-settings" className="scroll-mt-6"><SettingsList deviceManagement={<><DeviceConnectionStatus /><LocalProfileSwitcher /></>} /></div>
        <footer className="me-footer"><span aria-hidden="true">✧</span><p>{copy.footer}</p></footer>
      </>}
    </div>
  </AppScreen>;
}
