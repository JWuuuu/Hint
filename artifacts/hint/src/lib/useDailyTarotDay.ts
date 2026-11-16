import { useEffect, useState } from "react";
import { getDailyTarotDay, subscribeToDailyReceiptFallbacks } from "./dailyReceipts";

/** Other features keep their local calendar; Daily Tarot follows the server's UTC day. */
export function useDailyTarotDay() {
  const [day, setDay] = useState(getDailyTarotDay);
  useEffect(() => {
    const update = () => setDay(getDailyTarotDay());
    const unsubscribe = subscribeToDailyReceiptFallbacks(update);
    const timer = window.setInterval(update, 15000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => { unsubscribe(); clearInterval(timer); window.removeEventListener("focus", update); document.removeEventListener("visibilitychange", update); };
  }, []);
  return day;
}
