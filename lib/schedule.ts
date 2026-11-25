import type { Obligation } from './finance';

export const occurrenceDate = (plan: Obligation) => plan.scheduledFor ?? plan.due;
export const isIncomePlan = (plan: Obligation) => plan.direction === 'income';
export function isPending(plan: Obligation) {
  return plan.status !== 'cancelled' && plan.status !== 'completed' && !plan.paidDates.includes(occurrenceDate(plan));
}
export function reminderAt(plan: Obligation) {
  return plan.remindAt ?? new Date(plan.due + 'T' + (plan.reminderTime ?? '09:00') + ':00+03:00').toISOString();
}
export function addDays(date: string, days: number) {
  const time = new Date(date + 'T12:00:00Z');
  time.setUTCDate(time.getUTCDate() + days);
  return time.toISOString().slice(0, 10);
}
export function nextMonth(date: string, anchor = Number(date.slice(8))) {
  const [year, month] = date.split('-').map(Number);
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(last, anchor))).toISOString().slice(0, 10);
}
function nextDate(plan: Obligation, from: string) {
  if (plan.recurrence === 'once') return undefined;
  const anchor = plan.anchorDay ?? Number((plan.paidDates[0] ?? occurrenceDate(plan)).slice(8));
  const next = plan.recurrence === 'weekly' ? addDays(from, 7) : nextMonth(from, anchor);
  return (!plan.endsOn || next <= plan.endsOn) && next > from ? next : undefined;
}
export function advancePlan(plan: Obligation, paid: boolean): Obligation {
  const date = occurrenceDate(plan);
  const next = nextDate(plan, date);
  const { scheduledFor, remindAt, ...rest } = plan;
  return { ...rest, due: next ?? plan.due, scheduledFor: next ? undefined : scheduledFor,
    paidDates: paid ? [...plan.paidDates, date] : plan.paidDates,
    status: next ? 'upcoming' : paid ? 'completed' : 'cancelled' };
}

/** The displayed date can move independently of the weekly or monthly contract. */
export function* occurrences(plan: Obligation, start: string, end: string) {
  if (plan.status === 'cancelled' || plan.status === 'completed') return;
  let original: string | undefined = occurrenceDate(plan);
  let date = plan.due;
  while (original && (original <= end || date <= end)) {
    if (date >= start && date <= end) yield { original, date };
    original = nextDate(plan, original);
    if (original) date = original;
  }
}
