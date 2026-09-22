const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const day = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short" });

export function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${day.format(d)}, ${time.format(d)}`;
}

/** "3h ago", "2d ago", "just now". */
export function timeAgo(iso: string, now = Date.now()) {
  const minutes = Math.round((now - new Date(iso).getTime()) / 6e4);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Due label for the ledger: "Overdue 2h", "Today, 3:30 PM", "Tomorrow, 11:30 AM", "Fri, 2:00 PM". */
export function formatDue(iso: string, open: boolean, now = Date.now()) {
  const due = new Date(iso);
  if (!open) return `Due ${day.format(due)}`;
  const diff = due.getTime() - now;
  if (diff < 0) {
    const hours = Math.max(1, Math.round(-diff / 36e5));
    return hours < 24 ? `Overdue ${hours}h` : `Overdue ${Math.round(hours / 24)}d`;
  }
  const dayDelta = Math.round((new Date(due.toDateString()).getTime() - new Date(new Date(now).toDateString()).getTime()) / 864e5);
  const prefix = dayDelta === 0 ? "Today" : dayDelta === 1 ? "Tomorrow" : dayDelta < 7 ? weekday.format(due) : day.format(due);
  return `${prefix}, ${time.format(due)}`;
}

export const shortDay = (date: Date) => weekday.format(date);
