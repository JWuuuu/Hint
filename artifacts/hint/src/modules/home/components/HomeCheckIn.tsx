import { useEffect, useRef, useState } from "react";
import { CalendarCheck2, CalendarDays, Check, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "../../../components/ui/dialog";
import { captureIdentityContext, getAnonId, getLocalDateString } from "../../../lib/identity";
import type { DailyReceipt } from "../../../lib/dailyReceipts";
import { useLanguage, type HintLanguage } from "../../../lib/i18n";
import {
  getHomeCheckInProgress, recordHomeCheckIn, subscribeToHomeCheckIn,
} from "../data/homeCheckIn";
import "./home-check-in.css";

const THEMES: Record<HintLanguage, readonly string[]> = {
  en: ["Mercury", "Pluto", "Venus", "Moon", "Mars", "Jupiter", "Saturn"],
  zh: ["水星", "冥王星", "金星", "月亮", "火星", "木星", "土星"],
  es: ["Mercurio", "Plutón", "Venus", "Luna", "Marte", "Júpiter", "Saturno"],
  ja: ["水星", "冥王星", "金星", "月", "火星", "木星", "土星"],
  ko: ["수성", "명왕성", "금성", "달", "화성", "목성", "토성"],
};

type CheckInCopy = {
  label: string; calendar: string; reveal: string; preparing: string; day: (day: number) => string;
  title: string; description: string; streak: string; credits: string; today: string;
  completed: string; missed: string; future: string; daily: string; bonus: string;
  device: string; session: string; previous: string; next: string; progress: (count: number) => string;
};

const COPY: Record<HintLanguage, CheckInCopy> = {
  en: {
    label: "Check-in", calendar: "Calendar", reveal: "Reveal", preparing: "Preparing",
    day: n => `Day ${n}`, title: "Your check-in calendar",
    description: "Flip today’s daily card to check in and light your next star.",
    streak: "Day streak", credits: "Credits earned", today: "Today", completed: "Checked in",
    missed: "No check-in on this day.", future: "This day has not arrived yet.",
    daily: "Daily reward", bonus: "Streak bonus", device: "Check-ins and credits are saved on this device.",
    session: "Check-ins are available for this session. Device storage is unavailable.",
    previous: "Previous month", next: "Next month", progress: n => `${n} of 7 stars lit`,
  },
  zh: {
    label: "每日打卡", calendar: "日历", reveal: "翻牌", preparing: "准备中",
    day: n => `第 ${n} 天`, title: "我的打卡日历", description: "翻开今日每日牌，完成打卡并点亮下一颗星。",
    streak: "连续天数", credits: "累计积分", today: "今天", completed: "已打卡",
    missed: "这一天没有打卡记录。", future: "这一天还未到来。", daily: "每日奖励", bonus: "连续奖励",
    device: "打卡记录和积分保存在当前设备。", session: "设备存储不可用，打卡记录仅在本次会话保留。",
    previous: "上个月", next: "下个月", progress: n => `已点亮 ${n} / 7 颗星`,
  },
  es: {
    label: "Registro", calendar: "Calendario", reveal: "Revelar", preparing: "Preparando",
    day: n => `Día ${n}`, title: "Tu calendario de registro",
    description: "Revela la carta de hoy para registrarte e iluminar tu próxima estrella.",
    streak: "Días seguidos", credits: "Créditos ganados", today: "Hoy", completed: "Registrado",
    missed: "No hay registro este día.", future: "Este día aún no ha llegado.", daily: "Recompensa diaria", bonus: "Bono de racha",
    device: "Los registros y créditos se guardan en este dispositivo.", session: "Registros disponibles en esta sesión. El almacenamiento no está disponible.",
    previous: "Mes anterior", next: "Mes siguiente", progress: n => `${n} de 7 estrellas iluminadas`,
  },
  ja: {
    label: "チェックイン", calendar: "カレンダー", reveal: "めくる", preparing: "準備中",
    day: n => `${n}日目`, title: "チェックインカレンダー", description: "今日のカードをめくって、次の星を灯しましょう。",
    streak: "連続日数", credits: "獲得ポイント", today: "今日", completed: "完了",
    missed: "この日の記録はありません。", future: "この日はまだ来ていません。", daily: "毎日の報酬", bonus: "連続ボーナス",
    device: "記録とポイントはこの端末に保存されます。", session: "端末に保存できないため、このセッションのみ記録されます。",
    previous: "前の月", next: "次の月", progress: n => `7つの星のうち${n}つ点灯`,
  },
  ko: {
    label: "체크인", calendar: "달력", reveal: "뒤집기", preparing: "준비 중",
    day: n => `${n}일째`, title: "체크인 달력", description: "오늘의 카드를 뒤집고 다음 별을 밝혀 보세요.",
    streak: "연속 일수", credits: "획득 포인트", today: "오늘", completed: "체크인 완료",
    missed: "이날의 체크인 기록이 없어요.", future: "아직 오지 않은 날이에요.", daily: "일일 보상", bonus: "연속 보너스",
    device: "체크인과 포인트는 현재 기기에 저장돼요.", session: "기기 저장소를 사용할 수 없어 이번 세션에만 기록돼요.",
    previous: "이전 달", next: "다음 달", progress: n => `별 7개 중 ${n}개 점등`,
  },
};

const STAR_POINTS = [[8, 14], [32, 5], [56, 5], [80, 10], [104, 15], [128, 18], [152, 10]];
const STAR_PATH = "M0-4.5 1.4-1.5 4.7-1.5 2 .9 3 4.2 0 2.3-3 4.2-2 .9-4.7-1.5-1.4-1.5Z";
const TRAIL_PATH = "M8 14 Q32 0 56 5 T104 15 Q128 24 152 10";

function monthStart(day: string) {
  const date = new Date(`${day}T12:00:00`);
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

function checkInIdentity() {
  const owner = getAnonId();
  let captured: ReturnType<typeof captureIdentityContext> | undefined;
  try { captured = captureIdentityContext(); }
  catch { /* Reading device storage may be blocked; keep the feature session-safe. */ }
  return {
    owner,
    assertCurrent() {
      if (captured) return captured.assertCurrent();
      if (getAnonId() !== owner) throw new DOMException("Local profile changed", "AbortError");
      try { captureIdentityContext().assertCurrent(); }
      catch (error) {
        if (!(error instanceof DOMException && error.name === "SecurityError")) throw error;
      }
    },
  };
}

export function HomeCheckIn({
  today, receipt, ready, revealing, onReveal,
}: {
  today: string;
  receipt: DailyReceipt | null;
  ready: boolean;
  revealing: boolean;
  onReveal: () => void | Promise<void>;
}) {
  const { language } = useLanguage();
  const copy = COPY[language];
  const [identity] = useState(checkInIdentity);
  const [progress, setProgress] = useState(() => getHomeCheckInProgress(identity.owner, today));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [month, setMonth] = useState(() => monthStart(today));
  const [selectedDay, setSelectedDay] = useState(today);
  const returnFocus = useRef<HTMLElement | null>(null);
  const revealingFromCalendar = useRef(false);

  useEffect(() => {
    const update = () => {
      try {
        identity.assertCurrent();
        setProgress(getHomeCheckInProgress(identity.owner, today));
      } catch { /* A profile transition remounts the home with its new owner. */ }
    };
    update();
    return subscribeToHomeCheckIn(update);
  }, [identity, today]);

  useEffect(() => {
    if (!ready || receipt?.anonId !== identity.owner || receipt.dailyKey !== today ||
      receipt.featureType !== "daily-card" || !receipt.openedAt) return;
    try {
      identity.assertCurrent();
      setProgress(recordHomeCheckIn(identity.owner, today));
    } catch { /* A late receipt must not credit another profile or another day. */ }
  }, [identity, today, ready, receipt?.anonId, receipt?.dailyKey, receipt?.featureType, receipt?.openedAt]);

  const completed = progress.todayCompleted;
  const theme = THEMES[language][progress.cycleDay - 1];
  const Icon = completed ? CalendarCheck2 : CalendarDays;
  const pending = !ready || revealing;
  const caption = `${copy.day(progress.activeDay)} · ${theme}${completed ? ` · +${progress.todayCredits}` : ""}`;
  const revealLabel = `${copy.reveal} +${progress.nextCredits}`;

  function openCalendar() {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    revealingFromCalendar.current = false;
    setMonth(monthStart(today));
    setSelectedDay(today);
    setCalendarOpen(true);
  }

  function reveal() {
    if (pending || completed) return;
    try { identity.assertCurrent(); } catch { return; }
    revealingFromCalendar.current = true;
    setCalendarOpen(false);
    void onReveal();
  }

  function moveMonth(amount: number) {
    const next = new Date(month.getFullYear(), month.getMonth() + amount, 1, 12);
    setMonth(next);
    setSelectedDay(getLocalDateString(next));
  }

  const firstWeekday = month.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const selected = progress.records.find(record => record.date === selectedDay);
  const selectedTheme = selected ? THEMES[language][(selected.streak - 1) % 7] : null;
  const locale = language === "zh" ? "zh-CN" : language;
  const formatDate = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(locale, {
    month: "long", day: "numeric", year: "numeric",
  });

  return (
    <>
      <div className="hint-home-checkin" data-testid="home-check-in" data-completed={completed}>
        <button type="button" className="hint-home-checkin-label" onClick={openCalendar}
          aria-label={copy.title}>
          <Icon size={17} strokeWidth={1.5} aria-hidden="true" />
          <span>{copy.label}</span>
        </button>
        <button type="button" className="hint-home-checkin-trail"
          onClick={completed ? openCalendar : reveal} disabled={!completed && pending}
          aria-label={`${caption}. ${copy.progress(progress.completedInCycle)}. ${completed ? copy.completed : revealLabel}`}>
          <svg viewBox="0 0 160 26" aria-hidden="true" focusable="false">
            <path d={TRAIL_PATH} className="hint-home-checkin-orbit" />
            {progress.completedInCycle > 1 && (
              <path d={TRAIL_PATH} className="hint-home-checkin-orbit-done" pathLength={6}
                strokeDasharray={`${progress.completedInCycle - 1} 6`} />
            )}
            {STAR_POINTS.map(([x, y], index) => (
              <path key={index} d={STAR_PATH} transform={`translate(${x} ${y})`}
                className="hint-home-checkin-star"
                data-lit={index < progress.completedInCycle}
                data-current={index === progress.cycleDay - 1} />
            ))}
          </svg>
          <span aria-live="polite" aria-atomic="true">{caption}</span>
        </button>
        <button type="button" className="hint-home-checkin-action"
          onClick={completed ? openCalendar : reveal} disabled={!completed && pending}
          aria-label={completed ? copy.title : `${copy.description} ${revealLabel}`}>
          <span>{completed ? copy.calendar : pending ? copy.preparing : revealLabel}</span>
          <ChevronRight size={12} strokeWidth={1.6} aria-hidden="true" />
        </button>
      </div>

      <Dialog open={calendarOpen} onOpenChange={setCalendarOpen}>
        <DialogContent className="hint-home-checkin-dialog" onCloseAutoFocus={event => {
          event.preventDefault();
          if (!revealingFromCalendar.current && returnFocus.current?.isConnected) returnFocus.current.focus();
        }}>
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>
          <div className="hint-home-checkin-stats">
            <div><strong>{progress.currentStreak}</strong><span>{copy.streak}</span></div>
            <div><strong>{progress.totalCredits}</strong><span>{copy.credits}</span></div>
          </div>
          <div className="hint-home-checkin-month">
            <button type="button" onClick={() => moveMonth(-1)} aria-label={copy.previous}>
              <ChevronLeft size={17} aria-hidden="true" />
            </button>
            <span>{month.toLocaleDateString(locale, { month: "long", year: "numeric" })}</span>
            <button type="button" onClick={() => moveMonth(1)} aria-label={copy.next}>
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          </div>
          <div className="hint-home-checkin-calendar" role="group" aria-label={copy.calendar}>
            {Array.from({ length: 7 }, (_, index) => (
              <span className="hint-home-checkin-weekday" key={`weekday-${index}`}>
                {new Date(2026, 10, 1 + index, 12).toLocaleDateString(locale, { weekday: "narrow" })}
              </span>
            ))}
            {Array.from({ length: cells }, (_, index) => {
              const day = index - firstWeekday + 1;
              if (day < 1 || day > daysInMonth) return <span key={`empty-${index}`} />;
              const date = getLocalDateString(new Date(month.getFullYear(), month.getMonth(), day, 12));
              const entry = progress.records.find(record => record.date === date);
              const isToday = date === today;
              return (
                <button key={date} type="button" onClick={() => setSelectedDay(date)}
                  className="hint-home-checkin-date" aria-pressed={selectedDay === date}
                  aria-current={isToday ? "date" : undefined}
                  aria-label={`${formatDate(date)}${isToday ? ` · ${copy.today}` : ""}${entry ? ` · ${copy.completed} · +${entry.credits}` : ""}`}
                  data-today={isToday} data-completed={Boolean(entry)} data-future={date > today}>
                  <span>{day}</span>
                  {entry ? <Check size={11} strokeWidth={2} aria-hidden="true" /> : <span className="hint-home-checkin-date-dot" />}
                </button>
              );
            })}
          </div>
          <div className="hint-home-checkin-day-details" aria-live="polite">
            <p>{formatDate(selectedDay)}</p>
            {selected ? (
              <>
                <strong><Check size={14} aria-hidden="true" /> {copy.completed} · {copy.day(selected.streak)} · {selectedTheme}</strong>
                <span>{copy.daily} +1{selected.credits > 1 ? ` · ${copy.bonus} +${selected.credits - 1}` : ""}</span>
              </>
            ) : selectedDay === today ? (
              <button type="button" className="hint-home-checkin-reveal" disabled={pending} onClick={reveal}>
                {pending ? copy.preparing : revealLabel}<ChevronRight size={14} aria-hidden="true" />
              </button>
            ) : <span>{selectedDay > today ? copy.future : copy.missed}</span>}
          </div>
          <p className="hint-home-checkin-storage">{progress.persistent ? copy.device : copy.session}</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
