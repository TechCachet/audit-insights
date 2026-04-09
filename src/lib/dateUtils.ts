const MINUTES_PER_DAY = 60 * 24;

export function diffDays(fromIso: string, to: Date): number {
  const from = new Date(fromIso);
  const minutes = (to.getTime() - from.getTime()) / 1000 / 60;
  return minutes / MINUTES_PER_DAY;
}

export function isPastDate(dateIso: string, now: Date): boolean {
  return new Date(dateIso).getTime() < now.getTime();
}

