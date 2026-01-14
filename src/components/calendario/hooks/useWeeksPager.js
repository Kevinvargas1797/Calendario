import { useCallback, useEffect, useRef, useState } from "react";

import { buildWeeksAround, getWeekStart, toISODate } from "../utils/date";

export function useWeeksPager({ initialCenterDate, beforeWeeks, afterWeeks }) {
  const [weeks, setWeeks] = useState(() =>
    buildWeeksAround(initialCenterDate, beforeWeeks, afterWeeks)
  );

  const listRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Si reconstruimos weeks, aquí guardamos ISO a enfocar cuando termine el setState
  const pendingFocusISORef = useRef(null);

  const doScrollToWeekStartISO = useCallback(
    (weekStartISO, animated = true) => {
      const idx = weeks.findIndex((w) => w.weekStartISO === weekStartISO);
      if (idx >= 0) {
        listRef.current?.scrollToIndex({ index: idx, animated });
        setCurrentIndex(idx);
        return true;
      }
      return false;
    },
    [weeks]
  );

  const ensureAndScrollToDate = useCallback(
    (dateObj, animated = true) => {
      const weekStartISO = toISODate(getWeekStart(dateObj));

      if (doScrollToWeekStartISO(weekStartISO, animated)) return;

      pendingFocusISORef.current = weekStartISO;
      setWeeks(buildWeeksAround(dateObj, beforeWeeks, afterWeeks));
    },
    [beforeWeeks, afterWeeks, doScrollToWeekStartISO]
  );

  useEffect(() => {
    const pending = pendingFocusISORef.current;
    if (!pending) return;

    const ok = doScrollToWeekStartISO(pending, false);
    if (ok) pendingFocusISORef.current = null;
  }, [weeks, doScrollToWeekStartISO]);

  return {
    weeks,
    setWeeks,
    listRef,
    currentIndex,
    setCurrentIndex,
    ensureAndScrollToDate,
    doScrollToWeekStartISO,
  };
}
