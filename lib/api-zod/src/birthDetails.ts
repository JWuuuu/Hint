/** Shared calendar and birth-input validation. Never infer missing birth data. */
export type BirthDetails = {
  name?: string | null; birthDate?: string | null; birthTime?: string | null; birthPlace?: string | null;
  latitude?: number | null; longitude?: number | null; timezone?: string | null; timezoneOffset?: number | null;
};
export function optionalBirthNumber(value: unknown): number | undefined {
  if (value == null || typeof value === "string" && !value.trim()) return undefined;
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}
export function validBirthDate(value: string, today = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return day <= days[month - 1] && value <= todayKey;
}
export function birthDetailsError(input: BirthDetails): string | null {
  if (!input.birthDate || !validBirthDate(input.birthDate)) return "birthDate";
  if (input.birthTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.birthTime)) return "birthTime";
  for (const [key, min, max] of [["latitude", -90, 90], ["longitude", -180, 180], ["timezoneOffset", -12, 14]] as const) {
    const value = input[key];
    if (value != null && (!Number.isFinite(value) || value < min || value > max)) return key;
  }
  if (input.timezone) { try { new Intl.DateTimeFormat("en", { timeZone: input.timezone }); } catch { return "timezone"; } }
  return null;
}
export function birthInputFingerprint(input: BirthDetails): string {
  return JSON.stringify([input.birthDate ?? "", input.birthTime ?? "", input.birthPlace?.trim() ?? "", input.latitude ?? null, input.longitude ?? null, input.timezone ?? "", input.timezoneOffset ?? null]);
}
