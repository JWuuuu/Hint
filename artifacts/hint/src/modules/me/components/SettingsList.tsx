import { useSyncExternalStore, type ReactNode } from "react";
import { ChevronRight, Globe2, Moon, Sparkles, Sun, Vibrate, Wind, type LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { LanguageToggle } from "../../../components/LanguageToggle";
import { useLanguage } from "../../../lib/i18n";
import { HINT_PREFERENCES_UPDATED_EVENT, setHintThemePreference, useHintPreferences } from "../../../lib/preferences";
import { getInitialHintTheme, type HintTheme } from "../../../components/app/theme";
import { ME_COPY } from "../meCopy";

export type Row = { id: string; icon: LucideIcon; label: string; detail?: string; href?: string; danger?: boolean; disabled?: boolean; onClick?: () => void };

function subscribeTheme(listener: () => void) {
  window.addEventListener(HINT_PREFERENCES_UPDATED_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => { window.removeEventListener(HINT_PREFERENCES_UPDATED_EVENT, listener); window.removeEventListener("storage", listener); };
}

/** The everyday choices. The person's data and help close the page as its P.S. */
export function SettingsList() {
  const theme = useSyncExternalStore(subscribeTheme, getInitialHintTheme, () => "dark");
  const { preferences, setPreference } = useHintPreferences();
  const { language, t } = useLanguage();
  const copy = ME_COPY[language];
  return <div className="me-settings-stack">
    <section className="me-section" aria-labelledby="me-preferences-heading">
      <div className="me-section-heading"><h2 id="me-preferences-heading">{copy.preferences}</h2></div>
      <div className="me-group me-preferences">
        {/* Appearance is one choice between two skies: a two-way switch, not two cards. */}
        <div className="me-mood">
          <span className="me-mood-label" id="me-appearance-label">{copy.appearance}</span>
          <div className="me-theme-options" role="group" aria-labelledby="me-appearance-label">
            <ThemeButton theme="bright" active={theme === "bright"} icon={Sun} label={copy.bright} onClick={() => setHintThemePreference("bright")} />
            <ThemeButton theme="dark" active={theme === "dark"} icon={Moon} label={copy.dark} onClick={() => setHintThemePreference("dark")} />
          </div>
        </div>
        <ControlRow icon={Globe2} label={t("language.switch")} control={<LanguageToggle menuPlacement="bottom" menuClassName="me-language-menu" />} />
        <ControlRow icon={Wind} label={t("me.reduceMotion")} detail={copy.motionDetail} control={<ToggleSwitch label={t("me.reduceMotion")} checked={preferences.reduceMotion} onChange={checked => setPreference("reduceMotion", checked)} />} />
        <ControlRow icon={Vibrate} label={copy.feedback} detail={copy.feedbackDetail} control={<ToggleSwitch label={copy.feedback} checked={preferences.soundAndHaptics} onChange={checked => setPreference("soundAndHaptics", checked)} />} />
        <SettingsRow row={{ id: "tarot", icon: Sparkles, label: t("me.settings.tarotTitle"), detail: t("me.settings.tarotDetail"), href: "/app/tarot?setup=1" }} />
      </div>
    </section>
  </div>;
}

export function IconTile({ icon: Icon }: { icon: LucideIcon }) { return <span className="me-setting-icon" aria-hidden="true"><Icon size={18} strokeWidth={1.5} /></span>; }

export function SettingsRow({ row }: { row: Row }) {
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
    <span className="me-theme-swatch" aria-hidden="true"><Icon size={15} strokeWidth={1.5} /></span>
    <span>{label}</span>
  </button>;
}

function ToggleSwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className="me-switch"><span aria-hidden="true"><i /></span></button>;
}
