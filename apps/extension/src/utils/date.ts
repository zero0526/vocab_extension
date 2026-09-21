/**
 * Returns date in YYYY-MM-DD format based on local system time.
 */
export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Format date for display in human-readable Vietnamese or English
 */
export function formatDateDisplay(dateKey: string): string {
  try {
    const [year, month, day] = dateKey.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("vi-VN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateKey;
  }
}
