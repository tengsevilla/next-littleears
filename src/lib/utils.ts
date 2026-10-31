export { cn } from "cn"

const dateFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })

/** "Oct 29, 3:04 PM" — compact timestamps for the studio. */
export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso))
}

/** 90500 → "1:31" — song lengths. */
export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}
