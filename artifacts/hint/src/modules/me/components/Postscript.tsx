import { useRef, useState } from "react";
import { ChevronDown, ChevronRight, Smartphone, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { useLanguage } from "../../../lib/i18n";
import { deleteHistory } from "../../../lib/clearHistory";
import { getAnonId } from "../../../lib/identity";
import { ME_COPY } from "../meCopy";
import { IconTile, SettingsRow } from "./SettingsList";

type StorageStatus = "synced" | "local" | "unsaved";

/**
 * The page closes like a letter: a sign-off, then a P.S. that holds the
 * practical things (where readings are kept, clearing them, and help), set
 * small and quiet under the signature instead of as more settings plates.
 */
export function LetterClose({ onOpenStorage, storageStatus }: { onOpenStorage: () => void; storageStatus: StorageStatus }) {
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

  return <footer className="me-footer">
    <div className="me-signoff"><span aria-hidden="true">✧</span><p>{copy.footer}</p></div>

    <section className="me-ps" aria-labelledby="me-ps-heading">
      <h2 id="me-ps-heading" className="me-ps-heading">
        <span className="me-ps-mark">{copy.ps}</span>{" "}
        <span className="me-ps-lead">{copy.psLead}</span>
      </h2>
      <div className="me-ps-body">
        <div className="me-ps-rows">
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
        <nav className="me-help me-help-links" aria-label={copy.help}>
          {helpLinks.map(link => <span key={link.id} className="me-help-item">
            <Link href={link.href} className="me-help-link">{link.label}</Link>
          </span>)}
        </nav>
      </div>
    </section>
  </footer>;
}
