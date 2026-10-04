import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ChevronDown, ChevronRight, FileText, Globe2, Info, LifeBuoy, Lock, Moon, Palette, ShieldAlert, Smartphone, Sparkles, Sun, Trash2, UserRound, Vibrate, Wind, type LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { LanguageToggle } from "../../../components/LanguageToggle";
import { useLanguage } from "../../../lib/i18n";
import { useLocalAccount } from "../../../lib/auth";
import { deleteHistory } from "../../../lib/clearHistory";
import { getAnonId } from "../../../lib/identity";
import { HINT_PREFERENCES_UPDATED_EVENT, setHintThemePreference, useHintPreferences } from "../../../lib/preferences";
import { getInitialHintTheme, type HintTheme } from "../../../components/app/theme";
import { ME_COPY } from "../meCopy";

type Row = { id: string; icon: LucideIcon; label: string; detail?: string; href?: string; danger?: boolean; disabled?: boolean; onClick?: () => void };

function subscribeTheme(listener: () => void) {
  window.addEventListener(HINT_PREFERENCES_UPDATED_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => { window.removeEventListener(HINT_PREFERENCES_UPDATED_EVENT, listener); window.removeEventListener("storage", listener); };
}

export function SettingsList({ deviceManagement }: { deviceManagement?: ReactNode }) {
  const theme = useSyncExternalStore(subscribeTheme, getInitialHintTheme, () => "dark");
  const { preferences, setPreference } = useHintPreferences();
  const { language, t } = useLanguage();
  const copy = ME_COPY[language];
  const account = useLocalAccount();
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

  function chooseTheme(nextTheme: HintTheme) { setHintThemePreference(nextTheme); }

  const supportRows: Row[] = [
    { id: "about", icon: Info, label: t("me.about"), detail: t("me.aboutDetail"), href: "/about" },
    { id: "support", icon: LifeBuoy, label: t("me.support"), detail: copy.supportDetail, href: "/contact" },
    { id: "privacy", icon: Lock, label: t("me.privacyPolicy"), detail: copy.privacyDetail, href: "/privacy" },
    { id: "terms", icon: FileText, label: t("me.terms"), detail: t("me.termsDetail"), href: "/terms" },
    { id: "disclaimer", icon: ShieldAlert, label: t("me.settings.disclaimerTitle"), detail: t("me.settings.disclaimerDetail"), href: "/disclaimer" },
  ];

  return <div className="me-settings-stack">
    <section className="me-section" aria-labelledby="me-preferences-heading">
      <div className="me-section-heading"><h2 id="me-preferences-heading">{copy.preferences}</h2></div>
      <p className="me-section-description">{copy.preferencesDetail}</p>
      <div className="me-surface me-preferences">
        <div className="me-appearance">
          <div className="me-setting-label"><IconTile icon={Palette} /><span><strong>{copy.appearance}</strong><span>{copy.appearanceDetail}</span></span></div>
          <div className="me-theme-options">
            <ThemeButton theme="bright" active={theme === "bright"} icon={Sun} label={copy.bright} onClick={() => chooseTheme("bright")} />
            <ThemeButton theme="dark" active={theme === "dark"} icon={Moon} label={copy.dark} onClick={() => chooseTheme("dark")} />
          </div>
        </div>
        <ControlRow icon={Globe2} label={t("language.switch")} detail={copy.languageDetail} control={<LanguageToggle menuPlacement="bottom" menuClassName="me-language-menu" />} />
        <ControlRow icon={Wind} label={t("me.reduceMotion")} detail={copy.motionDetail} control={<ToggleSwitch label={t("me.reduceMotion")} checked={preferences.reduceMotion} onChange={checked => setPreference("reduceMotion", checked)} />} />
        <ControlRow icon={Vibrate} label={copy.feedback} detail={copy.feedbackDetail} control={<ToggleSwitch label={copy.feedback} checked={preferences.soundAndHaptics} onChange={checked => setPreference("soundAndHaptics", checked)} />} />
        <SettingsRow row={{ id: "tarot", icon: Sparkles, label: t("me.settings.tarotTitle"), detail: t("me.settings.tarotDetail"), href: "/app/tarot?setup=1" }} />
      </div>
    </section>

    <section className="me-section" aria-labelledby="me-device-heading">
      <div className="me-section-heading"><h2 id="me-device-heading">{copy.device}</h2><Smartphone size={16} aria-hidden="true" /></div>
      <p className="me-section-description">{copy.deviceDetail}</p>
      <div className="me-device-content me-surface">
        <div className="me-beta-note"><Lock size={15} aria-hidden="true" /><p>{copy.beta}</p></div>
        {deviceManagement}
        {!account && <details className="me-access">
          <summary className="me-disclosure-summary"><IconTile icon={UserRound} /><span><strong>{copy.account}</strong><span>{copy.accountDetail}</span></span><ChevronDown size={16} aria-hidden="true" /></summary>
          <div className="me-access-actions"><Link href="/app/signup">{copy.create}<ChevronRight size={16} aria-hidden="true" /></Link><Link href="/app/login?mode=login">{copy.open}<ChevronRight size={16} aria-hidden="true" /></Link></div>
        </details>}
        <details className="me-data-disclosure">
          <summary className="me-disclosure-summary"><IconTile icon={Trash2} /><span><strong>{copy.clearLabel}</strong><span>{copy.clearIntro}</span></span><ChevronDown size={16} aria-hidden="true" /></summary>
          <SettingsRow row={{ id: "clear-history", icon: Trash2, label: clearing ? t("profile.keeping") : t("me.clearHistory"), detail: copy.clearDetail, danger: true, disabled: clearing, onClick: () => void clearHistory() }} />
          {clearError && <div role="alert" className="me-error"><p>{t("quality.clearError")}</p><button type="button" onClick={() => void clearHistory()} disabled={clearing}>{t("quality.retry")}</button></div>}
        </details>
      </div>
    </section>

    <section className="me-section"><details className="me-help me-surface">
      <summary className="me-disclosure-summary"><IconTile icon={LifeBuoy} /><span><strong>{copy.help}</strong><span>{copy.helpDetail}</span></span><ChevronDown size={16} aria-hidden="true" /></summary>
      {supportRows.map(row => <SettingsRow key={row.id} row={row} />)}
    </details></section>
  </div>;
}

function IconTile({ icon: Icon }: { icon: LucideIcon }) { return <span className="me-setting-icon" aria-hidden="true"><Icon size={18} strokeWidth={1.5} /></span>; }

function SettingsRow({ row }: { row: Row }) {
  const content = <><IconTile icon={row.icon} /><span className="me-row-copy"><strong>{row.label}</strong>{row.detail && <span>{row.detail}</span>}</span><ChevronRight size={16} aria-hidden="true" /></>;
  return row.href
    ? <Link href={row.href} className="me-settings-row">{content}</Link>
    : <button type="button" className="me-settings-row" data-danger={row.danger || undefined} disabled={row.disabled} onClick={row.onClick} data-testid={row.danger ? "button-clear-history" : undefined}>{content}</button>;
}

function ControlRow({ icon, label, detail, control }: { icon: LucideIcon; label: string; detail: string; control: ReactNode }) {
  return <div className="me-control-row"><div className="me-setting-label"><IconTile icon={icon} /><span><strong>{label}</strong><span>{detail}</span></span></div><span className="me-control">{control}</span></div>;
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
