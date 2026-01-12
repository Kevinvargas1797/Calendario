import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Pressable, View } from "react-native";

import { calendarLayoutStyles as styles } from "./styles";
import { useCalendarSelection } from "../../app/hooks/useCalendarSelection";
import TopBar from "./parts/TopBar";
import HeaderRow from "./parts/HeaderRow";
import WeekPager from "./parts/WeekPager";
import MonthModal from "./parts/MonthModal";

import {
  DOW,
  buildWeeksAround,
  getWeekStart,
  parseISODate,
  toISODate,
  startOfMonth,
  sameDayInMonth,
} from "./utils/date";

const BEFORE_WEEKS = 208; // ~4 años
const AFTER_WEEKS = 208;  // ~4 años

export default function Calendario({
  initialSelectedISO = toISODate(new Date()),
  onChangeDate,
}) {
  const { selectedISO, setSelectedISO } = useCalendarSelection();
  const selectedDate = useMemo(() => parseISODate(selectedISO), [selectedISO]);

  // ✅ weeks STATE (reconstruible on-demand)
  const [weeks, setWeeks] = useState(() =>
    buildWeeksAround(parseISODate(initialSelectedISO), BEFORE_WEEKS, AFTER_WEEKS)
  );

  const listRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // ✅ si reconstruimos weeks, aquí guardamos ISO a enfocar
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

      // si existe -> scroll ya
      if (doScrollToWeekStartISO(weekStartISO, animated)) return;

      // si no existe -> reconstruye semanas alrededor de dateObj
      pendingFocusISORef.current = weekStartISO;
      setWeeks(buildWeeksAround(dateObj, BEFORE_WEEKS, AFTER_WEEKS));
    },
    [doScrollToWeekStartISO]
  );

  // cuando weeks cambie, intenta enfocar
  useEffect(() => {
    const pending = pendingFocusISORef.current;
    if (!pending) return;

    const ok = doScrollToWeekStartISO(pending, false);
    if (ok) pendingFocusISORef.current = null;
  }, [weeks, doScrollToWeekStartISO]);

  const handleSelect = useCallback(
    (dateObj) => {
      const iso = toISODate(dateObj);
      setSelectedISO(iso, "calendar");
      onChangeDate?.(iso);
    },
    [onChangeDate, setSelectedISO]
  );

  // Si la selección viene de fuera (timeline, futuro: eventos), aseguramos scroll estable.
  const lastSelectedISORef = useRef(selectedISO);
  useEffect(() => {
    const prevISO = lastSelectedISORef.current;
    if (prevISO === selectedISO) return;
    lastSelectedISORef.current = selectedISO;
    ensureAndScrollToDate(parseISODate(selectedISO), true);
  }, [selectedISO, ensureAndScrollToDate]);

  // init: ubicar índice inicial según selectedDate
  useEffect(() => {
    const selWeekStart = toISODate(getWeekStart(selectedDate));
    const idx = weeks.findIndex((w) => w.weekStartISO === selWeekStart);
    const finalIdx = idx >= 0 ? idx : Math.floor(weeks.length / 2);

    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index: finalIdx, animated: false });
      setCurrentIndex(finalIdx);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // auto-selección del primer día de la semana (lunes) cuando cambias de semana por swipe
  const selectWeekStartByIndex = useCallback(
    (idx) => {
      const w = weeks[idx];
      if (!w) return;
      const weekStart = parseISODate(w.weekStartISO);
      handleSelect(weekStart);
    },
    [weeks, handleSelect]
  );

  // ✅ evita que el swipe/momentum pise un tap
  const suppressAutoSelectRef = useRef(false);

  // Modal mes
  const [monthModalOpen, setMonthModalOpen] = useState(false);

  // Anchor Y debajo del header Lun..Dom
  const [anchorYLocal, setAnchorYLocal] = useState(0);

  const toggleMonthModal = () => setMonthModalOpen((v) => !v);

  const pickFromMonth = (day) => {
    suppressAutoSelectRef.current = true;
    handleSelect(day);
    ensureAndScrollToDate(day, false);
  };

  // swipe mes infinito: mantiene día del mes (clamp) y sincroniza compacto
  const handleMonthChange = (newMonthStart) => {
    const nextSel = sameDayInMonth(newMonthStart, selectedDate);
    suppressAutoSelectRef.current = true;
    handleSelect(nextSel);
    ensureAndScrollToDate(nextSel, false);
  };

  return (
    <View style={styles.container}>
      <TopBar
        date={selectedDate}
        expanded={monthModalOpen}
        onToggleMonth={toggleMonthModal}
        onPrevWeek={() => {
          const prev = Math.max(0, currentIndex - 1);
          listRef.current?.scrollToIndex({ index: prev, animated: true });
          setCurrentIndex(prev);
          requestAnimationFrame(() => selectWeekStartByIndex(prev));
        }}
        onNextWeek={() => {
          const next = Math.min(weeks.length - 1, currentIndex + 1);
          listRef.current?.scrollToIndex({ index: next, animated: true });
          setCurrentIndex(next);
          requestAnimationFrame(() => selectWeekStartByIndex(next));
        }}
      />

      <View
        onLayout={(e) => {
          const { y, height } = e.nativeEvent.layout;
          setAnchorYLocal(y + height);
        }}
      >
        <HeaderRow dow={DOW} />
      </View>

      <WeekPager
        weeks={weeks}
        listRef={listRef}
        selectedDate={selectedDate}
        onSelectDate={(d) => {
          suppressAutoSelectRef.current = true;
          handleSelect(d);
          ensureAndScrollToDate(d, true);
        }}
        initialIndex={currentIndex}
        onIndexChange={(idx, fromSwipe) => {
          setCurrentIndex(idx);

          if (suppressAutoSelectRef.current) {
            suppressAutoSelectRef.current = false;
            return;
          }

          if (fromSwipe) {
            selectWeekStartByIndex(idx);
          }
        }}
      />

      {!monthModalOpen && (
        <>
          <Pressable
            onPress={toggleMonthModal}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={monthModalOpen ? "Contraer calendario" : "Expandir calendario"}
            accessibilityHint="Toca para alternar el calendario mensual"
            style={({ pressed }) => [
              styles.gripHandle,
              pressed && styles.gripHandlePressed,
            ]}
          />
          <View style={styles.bottomBorder} />
        </>
      )}

      <MonthModal
        visible={monthModalOpen}
        onClose={() => setMonthModalOpen(false)}
        selectedDate={selectedDate}
        onPickDay={pickFromMonth}
        anchorY={anchorYLocal}
        initialMonthStart={startOfMonth(selectedDate)}
        onMonthChange={handleMonthChange}
      />
    </View>
  );
}
