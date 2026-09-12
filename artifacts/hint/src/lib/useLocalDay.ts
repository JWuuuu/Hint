import { useEffect, useState } from "react";
import { getLocalDateString } from "./identity";
export function useLocalDay() {
  const [day, setDay] = useState(() => getLocalDateString());
  useEffect(() => {
    const update = () => setDay(getLocalDateString());
    const timer = window.setInterval(update, 15000);
    window.addEventListener("focus", update); document.addEventListener("visibilitychange", update);
    return () => { clearInterval(timer); window.removeEventListener("focus", update); document.removeEventListener("visibilitychange", update); };
  }, []);
  return day;
}
