export function computeNextDue(from: Date, intervalDays: number): Date {
  return new Date(from.getTime() + intervalDays * 24 * 60 * 60 * 1000);
}

export function daysFromNow(when: string | Date): number {
  const d = typeof when === "string" ? new Date(when) : when;
  return Math.round((d.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

export function dueLabel(nextDueAt: string | Date): { text: string; overdue: boolean } {
  const days = daysFromNow(nextDueAt);
  if (days < 0) return { text: `Overdue by ${-days}d`, overdue: true };
  if (days === 0) return { text: "Due today", overdue: false };
  if (days === 1) return { text: "Due tomorrow", overdue: false };
  return { text: `Due in ${days}d`, overdue: false };
}
