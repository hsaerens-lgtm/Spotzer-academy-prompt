/** A day as YYYY-MM-DD in local time (a pass at 00:30 in Belgium is already the next day; toISOString is UTC). */
export function localDay(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
