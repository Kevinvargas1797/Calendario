export function toISODateLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseISODateLocal(iso) {
  if (typeof iso !== "string") return null;
  const parts = iso.split("-");
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const monthIndex = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day)) return null;
  return new Date(year, monthIndex, day);
}

export function formatHourLabel(h) {
  const isPM = h >= 12;
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12} ${isPM ? "p.m." : "a.m."}`;
}

export function formatHourParts(h) {
  const isPM = h >= 12;
  const hour12 = ((h + 11) % 12) + 1;
  return {
    hour: String(hour12),
    suffix: isPM ? "p.m." : "a.m.",
  };
}
