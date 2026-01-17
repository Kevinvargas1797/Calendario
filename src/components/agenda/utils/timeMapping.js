export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function snap(value, step) {
  return Math.round(value / step) * step;
}

export function minutesToY(rowHeight, minutes) {
  return (minutes / 60) * rowHeight;
}

export function yToMinutes(rowHeight, y) {
  return (y / rowHeight) * 60;
}

export function clampMinutesInDay(minutes) {
  // 0..1439
  return clamp(minutes, 0, 24 * 60 - 1);
}
