import React, { memo, useCallback, useMemo, useRef, useState } from "react";
import { Dimensions, FlatList, ScrollView, StyleSheet, Text, View } from "react-native";
import { addDays, differenceInCalendarDays, startOfToday } from "date-fns";

import { colors, spacing, typography } from "../../theme";
import { useCalendarSelection } from "../../app/hooks/useCalendarSelection";

const LABEL_COL_WIDTH = 52;
const MINUTE_MARKS = [0, 15, 30, 45];
const DEFAULT_ROW_H = 68;

const { width: SCREEN_W } = Dimensions.get("window");
const PAGER_RANGE = 5; // permite saltar hasta 5 días en un swipe
const PAGER_CENTER_INDEX = PAGER_RANGE;

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

  // Páginas fijas (deltas -R..R). Permite avanzar varios días con un swipe rápido.
  const data = useMemo(() => {
    const pages = [];
    for (let delta = -PAGER_RANGE; delta <= PAGER_RANGE; delta += 1) {
      pages.push({ key: `d${delta}`, delta });
    }
    return pages;
  }, []);

  const listRef = useRef(null);
  const isResettingRef = useRef(false);
  const pendingExternalISORef = useRef(null);
  const externalAnimSeqRef = useRef(0);
  const externalDebounceTimerRef = useRef(null);
  const activeExternalTargetRef = useRef(null); // { iso: string, seq: number }

  // Preview: cambia selectedISO en medio del swipe (cuando ya pasó el umbral)
  const lastPreviewDeltaRef = useRef(0);

  const getLayout = useCallback((_, index) => {
    return { length: SCREEN_W, offset: SCREEN_W * index, index };
  }, []);

  const recenter = useCallback(() => {
    isResettingRef.current = true;
    listRef.current?.scrollToOffset({ offset: SCREEN_W * PAGER_CENTER_INDEX, animated: false });
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
    if (source === "timeline" || source === "timeline_preview") return;

    // En init u orígenes no-UI: aterriza directo al centro sin animación.
    if (source === "init") {
      setCursorDate(fromISO);
      requestAnimationFrame(() => recenter());
      return;
    }

    // Viene del calendario: animamos hacia izq/der según dirección.
    const diff = differenceInCalendarDays(fromISO, cur || fromISO);
    if (!diff) return;

    // Coalesce: si el usuario toca días muy rápido, animamos solo hacia el último.
    externalAnimSeqRef.current += 1;
    const seq = externalAnimSeqRef.current;
    pendingExternalISORef.current = selectedISO;

    if (externalDebounceTimerRef.current) {
      clearTimeout(externalDebounceTimerRef.current);
      externalDebounceTimerRef.current = null;
    }

    externalDebounceTimerRef.current = setTimeout(() => {
      if (seq !== externalAnimSeqRef.current) return;
      const pendingISO = pendingExternalISORef.current;
      const target = parseISODateLocal(pendingISO);
      const base = cursorRef.current;
      if (!pendingISO || !target || !base) return;

      const d = differenceInCalendarDays(target, base);
      if (!d) return;

      // Si el salto cabe dentro del rango, animamos hasta esa página.
      // Si es un salto grande, aterrizamos directo (evita animación rara).
      if (Math.abs(d) > PAGER_RANGE) {
        activeExternalTargetRef.current = null;
        pendingExternalISORef.current = null;
        setCursorDate(target);
        requestAnimationFrame(() => recenter());
        return;
      }

      activeExternalTargetRef.current = { iso: pendingISO, seq };

      recenter();
      requestAnimationFrame(() => {
        if (activeExternalTargetRef.current?.seq !== seq) return;
        listRef.current?.scrollToIndex({
          index: PAGER_CENTER_INDEX + d,
          animated: true,
        });
      });
    }, 60);
  }, [selectedISO, recenter, getLastSource]);

  const onScroll = useCallback(
    (e) => {
      if (isResettingRef.current) return;
      if (activeExternalTargetRef.current) return; // si viene del calendario, no preview

      const x = e.nativeEvent.contentOffset.x;
      const idxFloat = x / SCREEN_W;
      const idx = Math.round(idxFloat);
      const rawDelta = idx - PAGER_CENTER_INDEX;
      const delta = Math.max(-PAGER_RANGE, Math.min(PAGER_RANGE, rawDelta));

      // Si volvimos al centro, restaura selección (si había preview)
      if (!delta) {
        if (lastPreviewDeltaRef.current !== 0) {
          lastPreviewDeltaRef.current = 0;
          setSelectedISO(toISODateLocal(cursorRef.current), "timeline_preview");
        }
        return;
      }

      if (delta === lastPreviewDeltaRef.current) return;
      lastPreviewDeltaRef.current = delta;

      const previewDate = addDays(cursorRef.current, delta);
      setSelectedISO(toISODateLocal(previewDate), "timeline_preview");
    },
    [setSelectedISO]
  );

  const onEnd = useCallback(
    (e) => {
      if (isResettingRef.current) return;

      const x = e.nativeEvent.contentOffset.x;
      const idx = Math.round(x / SCREEN_W);
      if (idx === PAGER_CENTER_INDEX) {
        // Si hubo preview y al final no se movió, restaurar.
        if (lastPreviewDeltaRef.current !== 0) {
          lastPreviewDeltaRef.current = 0;
          setSelectedISO(toISODateLocal(cursorRef.current), "timeline_preview");
        }
        return;
      }

      // Si el cambio fue disparado por selección del calendario, “aterrizamos” al target.
      const active = activeExternalTargetRef.current;
      if (active?.iso) {
        const target = parseISODateLocal(active.iso);
        // Ignora onEnd viejos (por ejemplo, si el usuario tocó otro día y reinició la animación).
        if (active.seq !== externalAnimSeqRef.current) return;

        pendingExternalISORef.current = null;
        activeExternalTargetRef.current = null;
        if (target) {
          setCursorDate(target);
        }
        requestAnimationFrame(() => recenter());
        return;
      }

      const delta = idx - PAGER_CENTER_INDEX;
      if (!delta) return;
      const nextCursor = addDays(cursorRef.current, delta);

      lastPreviewDeltaRef.current = 0;

      // Commit atómico para minimizar frames intermedios.
      recenter();
      setCursorDate(nextCursor);
      // Actualiza selección global: el calendario se mueve con esto.
      setSelectedISO(toISODateLocal(nextCursor), "timeline");
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
      extraData={cursorDate.getTime()}
      horizontal
      pagingEnabled
      decelerationRate="fast"
      onScroll={onScroll}
      scrollEventThrottle={16}
      showsHorizontalScrollIndicator={false}
      keyExtractor={(it) => it.key}
      renderItem={renderItem}
      getItemLayout={getLayout}
      initialScrollIndex={PAGER_CENTER_INDEX}
      onMomentumScrollEnd={onEnd}
      onScrollToIndexFailed={() => {
        requestAnimationFrame(() => recenter());
      }}
      windowSize={3}
      initialNumToRender={3}
      maxToRenderPerBatch={3}
      updateCellsBatchingPeriod={16}
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
