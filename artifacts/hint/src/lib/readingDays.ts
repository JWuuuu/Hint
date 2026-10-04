import { getLocalDateString } from "./identity";
export function countReadingDays(values: string[], firstDay: string, lastDay: string): number {
  const days = values.map(value => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value :
    Number.isFinite(new Date(value).getTime()) ? getLocalDateString(new Date(value)) : "");
  return new Set(days.filter(day => day && day >= firstDay && day <= lastDay)).size;
}
