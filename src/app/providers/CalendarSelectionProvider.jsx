import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { toISODate } from "../../components/calendario/utils/date";

let Haptics;
try {
  // Optional require: si por alguna razón el paquete no está, la app no revienta.
  // (Pero en este proyecto lo instalamos con `expo install expo-haptics`.)
  // eslint-disable-next-line global-require
  Haptics = require("expo-haptics");
} catch {
  Haptics = null;
}

const CalendarSelectionContext = createContext(null);

export function CalendarSelectionProvider({ children, initialSelectedISO }) {
  const initialISO = initialSelectedISO || toISODate(new Date());

  const [selectedISO, setSelectedISOState] = useState(initialISO);
  const lastSourceRef = useRef("init");

  const triggerHaptic = useCallback((source) => {
    if (!Haptics) return;
    if (source === "init") return;
    if (source === "timeline_preview") return;
    // iOS-like: un poquito más fuerte que "selection"
    const style = Haptics.ImpactFeedbackStyle?.Light;
    if (style) {
      Haptics.impactAsync?.(style).catch?.(() => {});
    } else {
      Haptics.selectionAsync?.().catch?.(() => {});
    }
  }, []);

  const setSelectedISO = useCallback((nextISO, source = "unknown") => {
    if (typeof nextISO !== "string") return;
    setSelectedISOState((prev) => {
      if (prev === nextISO) return prev;
      lastSourceRef.current = source;
      triggerHaptic(source);
      return nextISO;
    });
  }, [triggerHaptic]);

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
