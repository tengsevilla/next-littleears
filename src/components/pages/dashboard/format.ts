const numberFormat = new Intl.NumberFormat("en");
export const formatCount = (n: number) => numberFormat.format(n);

const dayFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });
/** "2026-11-04" (a UTC day from the API) → "Nov 4". */
export function formatDay(date: string): string {
  const t = Date.parse(`${date}T00:00:00Z`);
  return Number.isNaN(t) ? date : dayFormat.format(t);
}
