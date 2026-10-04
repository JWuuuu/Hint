import { CalendarDays, Clock3, MapPin, Pencil } from "lucide-react";
import type { Profile } from "@workspace/api-client-react";
import { useLanguage } from "../../../lib/i18n";
import { useLocalAccount } from "../../../lib/auth";
import { validBirthDate } from "../../../lib/birthDetails";
import { initialsFrom } from "../utils";
import { ME_COPY, ME_LOCALES } from "../meCopy";

export function ProfileCard({ profile, onEdit, storageStatus }: {
  profile: Profile | null;
  onEdit: () => void;
  storageStatus: "synced" | "local" | "unsaved";
}) {
  const { language, t } = useLanguage();
  const copy = ME_COPY[language];
  const account = useLocalAccount();
  const name = profile?.name?.trim() || account?.name?.trim() || t("me.guest");
  const birthDate = profile?.birthDate && validBirthDate(profile.birthDate)
    ? new Intl.DateTimeFormat(ME_LOCALES[language], { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })
      .format(new Date(`${profile.birthDate}T12:00:00Z`))
    : null;

  return <section className="me-identity me-surface" aria-label={copy.localProfile}>
    <div className="me-identity-orbit" aria-hidden="true"><span /><span /><i /></div>
    <div className="me-identity-top">
      <span className="me-monogram" aria-hidden="true">{initialsFrom(name)}</span>
      <button type="button" onClick={onEdit} className="me-edit-button" aria-label={t("me.editProfile")} data-testid="button-edit-profile">
        <Pencil size={14} aria-hidden="true" /><span>{copy.edit}</span>
      </button>
    </div>
    <p className="me-eyebrow">{copy.localProfile}</p>
    <h2 className="me-identity-name">{name}</h2>
    {profile && <p role="status" className="me-save-status" data-status={storageStatus}>
      <span aria-hidden="true" />{t(storageStatus === "synced" ? "quality.synced" : storageStatus === "local" ? "quality.savedLocal" : "quality.unsaved")}
    </p>}

    <div className="me-birth-summary">
      <h3>{copy.birthDetails}</h3>
      {birthDate ? <dl>
        <div><dt><CalendarDays size={14} aria-hidden="true" />{copy.date}</dt><dd>{birthDate}</dd></div>
        <div><dt><Clock3 size={14} aria-hidden="true" />{copy.time}</dt><dd>{profile?.birthTime || copy.unknownTime}</dd></div>
        <div><dt><MapPin size={14} aria-hidden="true" />{copy.place}</dt><dd>{profile?.birthPlace || copy.unknown}</dd></div>
      </dl> : <p className="me-description">{copy.birthMissing}</p>}
    </div>
  </section>;
}
