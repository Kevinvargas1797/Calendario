import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { toISODate } from "../../components/calendario/utils/date";

const CalendarSelectionContext = createContext(null);

export function CalendarSelectionProvider({ children, initialSelectedISO }) {
  const initialISO = initialSelectedISO || toISODate(new Date());

  const [selectedISO, setSelectedISOState] = useState(initialISO);
  const lastSourceRef = useRef("init");

  const setSelectedISO = useCallback((nextISO, source = "unknown") => {
    if (typeof nextISO !== "string") return;
    lastSourceRef.current = source;
    setSelectedISOState(nextISO);
  }, []);

  const value = useMemo(
    () => ({
      selectedISO,
      setSelectedISO,
      getLastSource: () => lastSourceRef.current,
    }),
    [selectedISO, setSelectedISO]
  );

  return (
    <CalendarSelectionContext.Provider value={value}>
      {children}
    </CalendarSelectionContext.Provider>
  );
}

export function useCalendarSelection() {
  const ctx = useContext(CalendarSelectionContext);
  if (!ctx) {
    throw new Error("useCalendarSelection must be used within CalendarSelectionProvider");
  }
  return ctx;
}
