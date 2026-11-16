import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useLanguage, type HintLanguage } from "../../../lib/i18n";
import { useMotionPolicy } from "../../../lib/motionPolicy";
import "./daily-check-in-reward.css";

const COPY: Record<HintLanguage, { checkIn: string; credits: (amount: number) => string }> = {
  en: { checkIn: "Checked in", credits: n => `${n} ${n === 1 ? "credit" : "credits"} earned` },
  zh: { checkIn: "打卡成功", credits: n => `获得 ${n} 积分` },
  es: { checkIn: "Registrado", credits: n => `${n} ${n === 1 ? "crédito ganado" : "créditos ganados"}` },
  ja: { checkIn: "チェックイン完了", credits: n => `${n}ポイント獲得` },
  ko: { checkIn: "체크인 완료", credits: n => `${n}포인트 획득` },
};

/** The parent supplies only a fresh award, never a saved balance or a predicted reward. */
export function DailyCheckInReward({ active, credits }: { active: boolean; credits: number | null }) {
  const { language } = useLanguage();
  const { reduced, pageVisible } = useMotionPolicy();
  const [visible, setVisible] = useState(false);
  const copy = COPY[language];

  useEffect(() => {
    if (!active || !credits || credits < 1) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 2000);
    return () => window.clearTimeout(timer);
  }, [active, credits]);

  if (!visible || !active || !credits || !pageVisible) return null;

  return (
    <div className="hint-daily-checkin-reward" data-testid="daily-check-in-reward"
      data-reduced={reduced} role="status" aria-label={`${copy.checkIn}. ${copy.credits(credits)}`}>
      <div className="hint-daily-checkin-reward-badge" aria-hidden="true">
        <Sparkles size={15} strokeWidth={1.4} />
        <strong>+{credits}</strong>
        <span>{copy.checkIn}</span>
      </div>
      <span className="hint-daily-checkin-spark hint-daily-checkin-spark-one" aria-hidden="true">✦</span>
      <span className="hint-daily-checkin-spark hint-daily-checkin-spark-two" aria-hidden="true">✦</span>
      <span className="hint-daily-checkin-spark hint-daily-checkin-spark-three" aria-hidden="true">✦</span>
    </div>
  );
}
