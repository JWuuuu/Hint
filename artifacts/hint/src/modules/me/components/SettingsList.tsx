import { useId, useRef, useSyncExternalStore, type ReactNode, type Ref } from "react";
import { ChevronRight, Globe2, Moon, Sparkles, Sun, Vibrate, Wind, type LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { LanguageToggle } from "../../../components/LanguageToggle";
import { useLanguage } from "../../../lib/i18n";
import { HINT_PREFERENCES_UPDATED_EVENT, setHintThemePreference, useHintPreferences } from "../../../lib/preferences";
import { getInitialHintTheme, type HintTheme } from "../../../components/app/theme";
import { ME_COPY } from "../meCopy";
import "./settings-preferences.css";

export type Row = { id: string; icon: LucideIcon; label: string; detail?: string; href?: string; danger?: boolean; disabled?: boolean; onClick?: () => void };

function subscribeTheme(listener: () => void) {
  window.addEventListener(HINT_PREFERENCES_UPDATED_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => { window.removeEventListener(HINT_PREFERENCES_UPDATED_EVENT, listener); window.removeEventListener("storage", listener); };
}

/** The everyday choices. The person's data and help close the page as its P.S. */
export function SettingsList() {
  const theme = useSyncExternalStore(subscribeTheme, getInitialHintTheme, () => "dark");
  const { preferences, persistence, setPreference, retryPreferences, retryTheme } = useHintPreferences();
  const { language, t } = useLanguage();
  const copy = ME_COPY[language];
  const statusId = useId();
  const themeStatusId = `${statusId}-theme`;
  const preferenceStatusId = `${statusId}-preferences`;
  const brightButton = useRef<HTMLButtonElement>(null);
  const darkButton = useRef<HTMLButtonElement>(null);
  const feedbackButton = useRef<HTMLButtonElement>(null);
  const lastPreferenceButton = useRef<HTMLButtonElement | null>(null);
  const pendingThemeLabel = persistence.pendingTheme === "bright" ? copy.bright : copy.dark;
  const changePreference = (key: "reduceMotion" | "soundAndHaptics", checked: boolean, button: HTMLButtonElement) => {
    lastPreferenceButton.current = button;
    setPreference(key, checked);
  };
  return <div className="me-settings-stack">
    <section className="me-section" aria-labelledby="me-preferences-heading">
      <div className="me-section-heading"><h2 id="me-preferences-heading">{copy.preferences}</h2></div>
      <div className="me-group me-preferences">
        {/* Appearance is one choice between two skies: a two-way switch, not two cards. */}
        <div className="me-mood">
          <span className="me-mood-label" id="me-appearance-label">{copy.appearance}</span>
          <div className="me-theme-options" role="group" aria-labelledby="me-appearance-label">
            <ThemeButton theme="bright" active={theme === "bright"} icon={Sun} label={copy.bright} buttonRef={brightButton} describedBy={themeStatusId} onClick={() => setHintThemePreference("bright")} />
            <ThemeButton theme="dark" active={theme === "dark"} icon={Moon} label={copy.dark} buttonRef={darkButton} describedBy={themeStatusId} onClick={() => setHintThemePreference("dark")} />
          </div>
          <SaveStatus id={themeStatusId}
            message={persistence.theme === "unsaved" ? copy.themeUnsaved.replace("{theme}", pendingThemeLabel) : persistence.theme === "saved" ? copy.themeSaved : ""}
            retryLabel={persistence.theme === "unsaved" ? copy.retryTheme.replace("{theme}", pendingThemeLabel) : undefined}
            onRetry={() => {
              const result = retryTheme();
              if (result?.saved) (result.theme === "bright" ? brightButton : darkButton).current?.focus();
            }} />
        </div>
        <ControlRow icon={Globe2} label={t("language.switch")} control={<LanguageToggle menuPlacement="bottom" menuClassName="me-language-menu" />} />
        <ControlRow icon={Wind} label={t("me.reduceMotion")} detail={copy.motionDetail} control={<ToggleSwitch label={t("me.reduceMotion")} checked={preferences.reduceMotion} describedBy={preferenceStatusId} onChange={(checked, button) => changePreference("reduceMotion", checked, button)} />} />
        <ControlRow icon={Vibrate} label={copy.feedback} detail={copy.feedbackDetail} control={<ToggleSwitch label={copy.feedback} checked={preferences.soundAndHaptics} buttonRef={feedbackButton} describedBy={preferenceStatusId} onChange={(checked, button) => changePreference("soundAndHaptics", checked, button)} />} />
        <SaveStatus id={preferenceStatusId}
          message={persistence.preferences === "unsaved" ? copy.preferencesUnsaved : persistence.preferences === "saved" ? copy.preferencesSaved : ""}
          retryLabel={persistence.preferences === "unsaved" ? copy.retryPreferences : undefined}
          onRetry={() => {
            if (retryPreferences().saved) (lastPreferenceButton.current ?? feedbackButton.current)?.focus();
          }} />
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

function SaveStatus({ id, message, retryLabel, onRetry }: { id: string; message: string; retryLabel?: string; onRetry: () => void }) {
  return <div className="me-preference-status" data-empty={!message || undefined}>
    <p id={id} role="status" aria-atomic="true">{message}</p>
    {retryLabel && <button type="button" className="me-preference-retry" aria-describedby={id} onClick={onRetry}>{retryLabel}</button>}
  </div>;
}

function ThemeButton({ active, theme, icon: Icon, label, onClick, buttonRef, describedBy }: { active: boolean; theme: HintTheme; icon: LucideIcon; label: string; onClick: () => void; buttonRef?: Ref<HTMLButtonElement>; describedBy: string }) {
  return <button type="button" ref={buttonRef} onClick={onClick} aria-pressed={active} aria-describedby={describedBy} className="me-theme-button" data-theme={theme}>
    <span className="me-theme-swatch" aria-hidden="true"><Icon size={15} strokeWidth={1.5} /></span>
    <span>{label}</span>
  </button>;
}

function ToggleSwitch({ label, checked, onChange, buttonRef, describedBy }: { label: string; checked: boolean; onChange: (checked: boolean, button: HTMLButtonElement) => void; buttonRef?: Ref<HTMLButtonElement>; describedBy: string }) {
  return <button type="button" ref={buttonRef} role="switch" aria-checked={checked} aria-label={label} aria-describedby={describedBy} onClick={event => onChange(!checked, event.currentTarget)} className="me-switch"><span aria-hidden="true"><i /></span></button>;
}
