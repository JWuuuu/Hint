import { ArrowLeft, ChevronDown, ChevronRight, Lock, UserRound } from "lucide-react";
import { Link } from "wouter";
import { useLanguage } from "../../../lib/i18n";
import { useLocalAccount } from "../../../lib/auth";
import { DeviceConnectionStatus } from "../../../components/app/DeviceConnectionStatus";
import { LocalProfileSwitcher } from "../../../components/app/LocalProfileSwitcher";
import { ME_COPY } from "../meCopy";

/**
 * Device plumbing lives one step away from the personal page: connection
 * state, local profiles, profile access and the beta storage note.
 */
export function StoragePanel({ onBack }: { onBack: () => void }) {
  const { language } = useLanguage();
  const copy = ME_COPY[language];
  const account = useLocalAccount();

  return <section className="me-edit-page me-storage-page" aria-labelledby="me-storage-heading">
    <button type="button" onClick={onBack} className="me-back"><ArrowLeft size={17} aria-hidden="true" />{copy.back}</button>
    <header className="me-heading">
      <h1 id="me-storage-heading" tabIndex={-1}>{copy.device}</h1>
      <p>{copy.deviceDetail}</p>
    </header>
    <div className="me-device-content me-group">
      <DeviceConnectionStatus />
      <LocalProfileSwitcher />
      {!account && <details className="me-access">
        <summary className="me-disclosure-summary">
          <span className="me-setting-icon" aria-hidden="true"><UserRound size={18} strokeWidth={1.5} /></span>
          <span><strong>{copy.account}</strong><span>{copy.accountDetail}</span></span>
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <div className="me-access-actions">
          <Link href="/app/signup">{copy.create}<ChevronRight size={16} aria-hidden="true" /></Link>
          <Link href="/app/login?mode=login">{copy.open}<ChevronRight size={16} aria-hidden="true" /></Link>
        </div>
      </details>}
    </div>
    <p className="me-beta-note"><Lock size={13} aria-hidden="true" /><span>{copy.beta}</span></p>
  </section>;
}
