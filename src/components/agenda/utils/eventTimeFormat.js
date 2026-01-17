// Utilidad para formatear el rango de horas de un evento dado el inicio y duración en minutos
export function formatEventTimeRange(startMinutes, durationMinutes) {
  const safeStart = Number.isFinite(startMinutes) ? startMinutes : 0;
  const safeDur = Number.isFinite(durationMinutes) ? durationMinutes : 0;

  const clampDay = (m) => Math.max(0, Math.min(24 * 60 - 1, Math.round(m)));
  const start = clampDay(safeStart);
  const end = clampDay(start + safeDur);

  const getSuffix = (h24) => (h24 >= 12 ? "P.M." : "A.M.");
  const to12 = (h24) => ((h24 + 11) % 12) + 1;
  const fmt = (h24, m) => {
    const h12 = to12(h24);
    if (!m) return String(h12);
    return `${h12}:${String(m).padStart(2, "0")}`;
  };

  const startH = Math.floor(start / 60);
  const startM = start % 60;
  const endH = Math.floor(end / 60);
  const endM = end % 60;

  const s1 = getSuffix(startH);
  const s2 = getSuffix(endH);
  const left = fmt(startH, startM);
  const right = fmt(endH, endM);

  // Estilo tipo imagen: sufijo una sola vez si coincide.
  if (s1 === s2) return `${left} – ${right}${s2}`;
  return `${left}${s1} – ${right}${s2}`;
}
