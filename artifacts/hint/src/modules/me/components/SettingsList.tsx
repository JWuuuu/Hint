import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Globe2, Moon, Smartphone, Sparkles, Sun, Trash2, Vibrate, Wind, type LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { LanguageToggle } from "../../../components/LanguageToggle";
import { useLanguage } from "../../../lib/i18n";
import { deleteHistory } from "../../../lib/clearHistory";
import { getAnonId } from "../../../lib/identity";
import { HINT_PREFERENCES_UPDATED_EVENT, setHintThemePreference, useHintPreferences } from "../../../lib/preferences";
import { getInitialHintTheme, type HintTheme } from "../../../components/app/theme";
import { ME_COPY } from "../meCopy";

type Row = { id: string; icon: LucideIcon; label: string; detail?: string; href?: string; danger?: boolean; disabled?: boolean; onClick?: () => void };
type StorageStatus = "synced" | "local" | "unsaved";

function subscribeTheme(listener: () => void) {
  window.addEventListener(HINT_PREFERENCES_UPDATED_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => { window.removeEventListener(HINT_PREFERENCES_UPDATED_EVENT, listener); window.removeEventListener("storage", listener); };
}

/** Everyday choices, then the person's data, then help: in that order of use. */
export function SettingsList({ onOpenStorage, storageStatus }: { onOpenStorage: () => void; storageStatus: StorageStatus }) {
  const theme = useSyncExternalStore(subscribeTheme, getInitialHintTheme, () => "dark");
  const { preferences, setPreference } = useHintPreferences();
  const { language, t } = useLanguage();
  const copy = ME_COPY[language];
  const [clearing, setClearing] = useState(false);
  const clearInFlight = useRef(false);
  const [clearError, setClearError] = useState(false);

  async function clearHistory() {
    if (clearInFlight.current || !window.confirm(t("quality.clearConfirm"))) return;
    clearInFlight.current = true;
    setClearing(true);
    setClearError(false);
    try { await deleteHistory(getAnonId()); window.location.reload(); }
    catch { setClearError(true); }
    finally { clearInFlight.current = false; setClearing(false); }
  }

  const status = t(storageStatus === "synced" ? "quality.synced" : storageStatus === "local" ? "quality.savedLocal" : "quality.unsaved");
  const helpLinks = [
    { id: "about", label: t("me.about"), href: "/about" },
    { id: "support", label: t("me.support"), href: "/contact" },
    { id: "privacy", label: t("me.privacyPolicy"), href: "/privacy" },
    { id: "terms", label: t("me.terms"), href: "/terms" },
    { id: "disclaimer", label: t("me.settings.disclaimerTitle"), href: "/disclaimer" },
  ];

  return <div className="me-settings-stack">
    <section className="me-section" aria-labelledby="me-preferences-heading">
      <div className="me-section-heading"><h2 id="me-preferences-heading">{copy.preferences}</h2></div>
      {/* Appearance is a choice between two skies, so it is shown as two previews. */}
      <div className="me-theme-options" role="group" aria-label={copy.appearance}>
        <ThemeButton theme="bright" active={theme === "bright"} icon={Sun} label={copy.bright} onClick={() => setHintThemePreference("bright")} />
        <ThemeButton theme="dark" active={theme === "dark"} icon={Moon} label={copy.dark} onClick={() => setHintThemePreference("dark")} />
      </div>
      <div className="me-group me-preferences">
        <ControlRow icon={Globe2} label={t("language.switch")} control={<LanguageToggle menuPlacement="bottom" menuClassName="me-language-menu" />} />
        <ControlRow icon={Wind} label={t("me.reduceMotion")} detail={copy.motionDetail} control={<ToggleSwitch label={t("me.reduceMotion")} checked={preferences.reduceMotion} onChange={checked => setPreference("reduceMotion", checked)} />} />
        <ControlRow icon={Vibrate} label={copy.feedback} detail={copy.feedbackDetail} control={<ToggleSwitch label={copy.feedback} checked={preferences.soundAndHaptics} onChange={checked => setPreference("soundAndHaptics", checked)} />} />
        <SettingsRow row={{ id: "tarot", icon: Sparkles, label: t("me.settings.tarotTitle"), detail: t("me.settings.tarotDetail"), href: "/app/tarot?setup=1" }} />
      </div>
    </section>

    <section className="me-section" aria-labelledby="me-data-heading">
      <div className="me-section-heading"><h2 id="me-data-heading">{copy.dataHeading}</h2></div>
      <div className="me-group">
        <button type="button" className="me-settings-row" onClick={onOpenStorage} data-testid="button-open-storage">
          <IconTile icon={Smartphone} />
          <span className="me-row-copy"><strong>{copy.device}</strong><span role="status" data-status={storageStatus}>{status}</span></span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
        <details className="me-data-disclosure">
          <summary className="me-disclosure-summary"><IconTile icon={Trash2} /><span><strong>{copy.clearLabel}</strong><span>{copy.clearIntro}</span></span><ChevronDown size={16} aria-hidden="true" /></summary>
          <SettingsRow row={{ id: "clear-history", icon: Trash2, label: clearing ? t("profile.keeping") : t("me.clearHistory"), detail: copy.clearDetail, danger: true, disabled: clearing, onClick: () => void clearHistory() }} />
          {clearError && <div role="alert" className="me-error"><p>{t("quality.clearError")}</p><button type="button" onClick={() => void clearHistory()} disabled={clearing}>{t("quality.retry")}</button></div>}
        </details>
      </div>
    </section>

    <section className="me-section me-help" aria-labelledby="me-help-heading">
      <div className="me-section-heading"><h2 id="me-help-heading">{copy.help}</h2></div>
      <nav className="me-help-links" aria-labelledby="me-help-heading">
        {helpLinks.map(link => <Link key={link.id} href={link.href} className="me-help-link">{link.label}</Link>)}
      </nav>
    </section>
  </div>;
}

function IconTile({ icon: Icon }: { icon: LucideIcon }) { return <span className="me-setting-icon" aria-hidden="true"><Icon size={18} strokeWidth={1.5} /></span>; }

function SettingsRow({ row }: { row: Row }) {
  const content = <><IconTile icon={row.icon} /><span className="me-row-copy"><strong>{row.label}</strong>{row.detail && <span>{row.detail}</span>}</span><ChevronRight size={16} aria-hidden="true" /></>;
  return row.href
    ? <Link href={row.href} className="me-settings-row">{content}</Link>
    : <button type="button" className="me-settings-row" data-danger={row.danger || undefined} disabled={row.disabled} onClick={row.onClick} data-testid={row.danger ? "button-clear-history" : undefined}>{content}</button>;
}

function ControlRow({ icon, label, detail, control }: { icon: LucideIcon; label: string; detail?: string; control: ReactNode }) {
  return <div className="me-control-row"><div className="me-setting-label"><IconTile icon={icon} /><span><strong>{label}</strong>{detail && <span>{detail}</span>}</span></div><span className="me-control">{control}</span></div>;
}

function ThemeButton({ active, theme, icon: Icon, label, onClick }: { active: boolean; theme: HintTheme; icon: LucideIcon; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className="me-theme-button" data-theme={theme}>
    <span className="me-theme-swatch" aria-hidden="true"><Icon size={19} strokeWidth={1.2} /><i /><i /></span>
    <span>{label}</span><span className="me-theme-check" aria-hidden="true">{active ? "✓" : ""}</span>
  </button>;
}

function ToggleSwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className="me-switch"><span aria-hidden="true"><i /></span></button>;
}
