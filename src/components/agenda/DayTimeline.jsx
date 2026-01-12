import React, { memo, useCallback, useMemo, useRef, useState } from "react";
import { Dimensions, FlatList, ScrollView, StyleSheet, Text, View } from "react-native";
import { addDays, differenceInCalendarDays, startOfToday } from "date-fns";

import { colors, spacing, typography } from "../../theme";
import { useCalendarSelection } from "../../app/hooks/useCalendarSelection";

const LABEL_COL_WIDTH = 52;
const MINUTE_MARKS = [0, 15, 30, 45];
const DEFAULT_ROW_H = 68;

const { width: SCREEN_W } = Dimensions.get("window");
const PAGER_CENTER_INDEX = 1;

function formatHourLabel(h) {
  const isPM = h >= 12;
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12} ${isPM ? "p.m." : "a.m."}`;
}

function toISODateLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseISODateLocal(iso) {
  if (typeof iso !== "string") return null;
  const parts = iso.split("-");
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const monthIndex = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day)) return null;
  return new Date(year, monthIndex, day);
}

const HourRow = memo(function HourRow({ hour, rowH }) {
  const minuteHeight = rowH / MINUTE_MARKS.length;

  return (
    <View style={[styles.row, { height: rowH }]}>
      {MINUTE_MARKS.map((minute) => {
        const isHourLine = minute === 0;

        return (
          <View
            key={`${hour}-${minute}`}
            style={[styles.minuteRow, { height: minuteHeight }]}
          >
            <View style={styles.labelCol}>
              <Text style={isHourLine ? styles.hourText : styles.minuteText}>
                {isHourLine
                  ? formatHourLabel(hour)
                  : minute.toString().padStart(2, "0")}
              </Text>
            </View>

            <View
              style={[
                styles.minuteLine,
                isHourLine ? styles.minuteLinePrimary : styles.minuteLineSecondary,
              ]}
            />
          </View>
        );
      })}
    </View>
  );
});

const DayTimelinePage = memo(function DayTimelinePage({ rowHeight, hours }) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {hours.map((h) => (
        <HourRow key={h} hour={h} rowH={rowHeight} />
      ))}
    </ScrollView>
  );
});

export default function DayTimeline({ rowHeight = DEFAULT_ROW_H, initialDate }) {
  const { selectedISO, setSelectedISO, getLastSource } = useCalendarSelection();
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

  const [cursorDate, setCursorDate] = useState(() => {
    const fromISO = parseISODateLocal(selectedISO);
    return fromISO || initialDate || startOfToday();
  });
  const cursorRef = useRef(cursorDate);
  cursorRef.current = cursorDate;

  const data = useMemo(() => {
    const cur = cursorDate;
    const prev = addDays(cur, -1);
    const next = addDays(cur, 1);
    return [
      { key: toISODateLocal(prev), date: prev },
      { key: toISODateLocal(cur), date: cur },
      { key: toISODateLocal(next), date: next },
    ];
  }, [cursorDate]);

  const listRef = useRef(null);
  const isResettingRef = useRef(false);
  const pendingExternalISORef = useRef(null);

  const getLayout = useCallback((_, index) => {
    return { length: SCREEN_W, offset: SCREEN_W * index, index };
  }, []);

  const recenter = useCallback(() => {
    isResettingRef.current = true;
    listRef.current?.scrollToIndex({ index: PAGER_CENTER_INDEX, animated: false });
    requestAnimationFrame(() => {
      isResettingRef.current = false;
    });
  }, []);

  // Si el calendario cambia la selección, sincronizamos el cursor del timeline.
  React.useEffect(() => {
    const fromISO = parseISODateLocal(selectedISO);
    if (!fromISO) return;

    const source = getLastSource?.() || "unknown";
    const cur = cursorRef.current;
    if (cur && cur.getTime() === fromISO.getTime()) return;

    // Si viene del propio timeline, no disparamos animación (evita loops).
    if (source === "timeline") return;

    // En init u orígenes no-UI: aterriza directo al centro sin animación.
    if (source === "init") {
      setCursorDate(fromISO);
      requestAnimationFrame(() => recenter());
      return;
    }

    // Viene del calendario: animamos hacia izq/der según dirección.
    const diff = differenceInCalendarDays(fromISO, cur || fromISO);
    if (!diff) return;

    pendingExternalISORef.current = selectedISO;
    const dir = diff > 0 ? 1 : -1;

    // Asegura que arrancamos desde el centro y luego animamos a la página destino.
    recenter();
    requestAnimationFrame(() => {
      if (pendingExternalISORef.current !== selectedISO) return;
      listRef.current?.scrollToIndex({
        index: dir > 0 ? 2 : 0,
        animated: true,
      });
    });
  }, [selectedISO, recenter, getLastSource]);

  const onEnd = useCallback(
    (e) => {
      if (isResettingRef.current) return;

      const x = e.nativeEvent.contentOffset.x;
      const idx = Math.round(x / SCREEN_W);
      if (idx === PAGER_CENTER_INDEX) return;

      // Si el cambio fue disparado por selección del calendario, “aterrizamos” al target.
      const pendingISO = pendingExternalISORef.current;
      if (pendingISO) {
        pendingExternalISORef.current = null;
        const target = parseISODateLocal(pendingISO);
        if (target) {
          setCursorDate(target);
        }
        requestAnimationFrame(() => recenter());
        return;
      }

      const dir = idx === 2 ? 1 : -1;
      const nextCursor = addDays(cursorRef.current, dir);
      setCursorDate(nextCursor);

      // Actualiza selección global: el calendario se mueve con esto.
      setSelectedISO(toISODateLocal(nextCursor), "timeline");

      requestAnimationFrame(() => recenter());
    },
    [recenter, setSelectedISO]
  );

  const renderItem = useCallback(
    () => (
      <View style={[styles.page, { width: SCREEN_W }]}>
        <DayTimelinePage rowHeight={rowHeight} hours={hours} />
      </View>
    ),
    [hours, rowHeight]
  );

  return (
    <FlatList
      ref={listRef}
      data={data}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      keyExtractor={(it) => it.key}
      renderItem={renderItem}
      getItemLayout={getLayout}
      initialScrollIndex={PAGER_CENTER_INDEX}
      onMomentumScrollEnd={onEnd}
      onScrollToIndexFailed={recenter}
    />
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.backgroundPrimary,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.backgroundPrimary,
  },
  content: {
    paddingBottom: spacing.lg,
  },
  row: {
    flexDirection: "column",
  },
  minuteRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  labelCol: {
    width: LABEL_COL_WIDTH,
    paddingRight: spacing.sm,
    alignItems: "flex-end",
  },
  hourText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  minuteText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  minuteLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.divider,
  },
  minuteLinePrimary: {
    opacity: 1,
  },
  minuteLineSecondary: {
    opacity: 0.45,
  },
});
