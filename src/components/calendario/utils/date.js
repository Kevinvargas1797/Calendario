import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  getDaysInMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";

export const WEEK_STARTS_ON = 1; // Lunes
export const DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function toISODate(d) {
  return format(d, "yyyy-MM-dd");
}

export function parseISODate(iso) {
  const [y, m, day] = iso.split("-").map(Number);
  return new Date(y, m - 1, day);
}

export function getWeekStart(date) {
  return startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON });
}

export function buildWeekDays(weekStart) {
  return Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
}

export function buildWeeksAround(centerDate, before = 78, after = 78) {
  const centerStart = getWeekStart(centerDate);
  const start = addWeeks(centerStart, -before);

  return Array.from({ length: before + after + 1 }).map((_, idx) => {
    const weekStart = addWeeks(start, idx);
    return {
      key: toISODate(weekStart),
      weekStartISO: toISODate(weekStart),
    };
  });
}

export function getMonthGridDays(monthStartDate) {
  const start = startOfWeek(startOfMonth(monthStartDate), {
    weekStartsOn: WEEK_STARTS_ON,
  });
  const end = endOfWeek(endOfMonth(monthStartDate), {
    weekStartsOn: WEEK_STARTS_ON,
  });

  const days = [];
  let cur = start;
  while (cur <= end) {
    days.push(cur);
    cur = addDays(cur, 1);
  }

  while (days.length < 42) days.push(addDays(days[days.length - 1], 1));
  if (days.length > 42) days.length = 42;

  return days;
}

export function clampDayInMonth(targetMonthStart, desiredDayOfMonth) {
  const dim = getDaysInMonth(targetMonthStart);
  return Math.min(Math.max(desiredDayOfMonth, 1), dim);
}

export function sameDayInMonth(targetMonthStart, baseDate) {
  const desired = baseDate.getDate();
  const day = clampDayInMonth(targetMonthStart, desired);
  return new Date(
    targetMonthStart.getFullYear(),
    targetMonthStart.getMonth(),
    day
  );
}

export function capitalize(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export { addMonths, startOfMonth };
