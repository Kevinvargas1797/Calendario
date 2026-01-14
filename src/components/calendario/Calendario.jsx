import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Pressable, View } from "react-native";
import { addDays, differenceInCalendarDays } from "date-fns";

import { calendarLayoutStyles as styles } from "./styles";
import { useCalendarSelection } from "../../app/hooks/useCalendarSelection";
import { useWeeksPager } from "./hooks/useWeeksPager";
import TopBar from "./parts/TopBar";
import HeaderRow from "./parts/HeaderRow";
import WeekPager from "./parts/WeekPager";
import MonthModal from "./parts/MonthModal";

import {
  DOW,
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
  const { selectedISO, setSelectedISO, getLastSource } = useCalendarSelection();
  const selectedDate = useMemo(() => parseISODate(selectedISO), [selectedISO]);
  const selectedDateRef = useRef(selectedDate);
  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  const {
    weeks,
    listRef,
    currentIndex,
    setCurrentIndex,
    ensureAndScrollToDate,
  } = useWeeksPager({
    initialCenterDate: parseISODate(initialSelectedISO),
    beforeWeeks: BEFORE_WEEKS,
    afterWeeks: AFTER_WEEKS,
  });

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

    const source = getLastSource?.() || "unknown";
    const dateObj = parseISODate(selectedISO);

    // Si el calendario mensual está abierto y el usuario empieza a cambiar día desde el timeline,
    // colapsamos de inmediato a modo compacto.
    if (monthModalOpen && (source === "timeline" || source === "timeline_preview")) {
      setMonthModalOpen(false);
    }

    if (source === "timeline" || source === "timeline_preview") {
      // Cuando vienes del timeline, prioriza que el gesto se sienta fluido.
      // Pero una vez que el timeline ya hizo commit (onMomentumScrollEnd),
      // queremos que el compacto se sincronice casi inmediato.
      // Lo hacemos en el siguiente frame y sin animación.
      requestAnimationFrame(() => {
        ensureAndScrollToDate(dateObj, false);
      });
      return;
    }

    ensureAndScrollToDate(dateObj, true);
  }, [selectedISO, ensureAndScrollToDate, getLastSource, monthModalOpen]);

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

  // ✅ cuando el cambio viene por swipe, conservamos el mismo weekday que estaba seleccionado.
  // Ej: semana 27..3 con domingo seleccionado (3) -> semana 20..26 selecciona domingo (26)
  const selectSameWeekdayByIndex = useCallback(
    (idx) => {
      const w = weeks[idx];
      if (!w) return;

      const weekStart = parseISODate(w.weekStartISO);
      const baseSelected = selectedDateRef.current;
      const baseWeekStart = getWeekStart(baseSelected);
      const offset = differenceInCalendarDays(baseSelected, baseWeekStart);
      const clamped = Math.max(0, Math.min(6, offset));
      const next = addDays(weekStart, clamped);
      handleSelect(next);
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
    // Lógica: si el día es mayor, animar derecha; si es menor, izquierda; si es igual, no animar
    const diff = differenceInCalendarDays(day, selectedDate);
    const animate = diff !== 0;
    ensureAndScrollToDate(day, animate);
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
            selectSameWeekdayByIndex(idx);
          }
        }}
      />

      {/* Mantener layout estable: no removemos el grip/borde cuando se abre el modal.
          Solo lo deshabilitamos y lo volvemos transparente. */}
      <Pressable
        onPress={toggleMonthModal}
        disabled={monthModalOpen}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={monthModalOpen ? "Calendario desplegado" : "Expandir calendario"}
        accessibilityHint="Toca para alternar el calendario mensual"
        style={({ pressed }) => [
          styles.gripHandle,
          pressed && !monthModalOpen && styles.gripHandlePressed,
          monthModalOpen && { opacity: 0 },
        ]}
      />
      <View style={[styles.bottomBorder, monthModalOpen && { opacity: 0 }]} />

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
