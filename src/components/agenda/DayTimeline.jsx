import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { Dimensions, FlatList, StyleSheet, Text, View, Pressable } from "react-native";
import { addDays, differenceInCalendarDays, isSameDay, startOfToday } from "date-fns";

import { colors, spacing, typography } from "../../theme";
import { useCalendarSelection } from "../../app/hooks/useCalendarSelection";

import DayTimelinePage from "./parts/DayTimelinePage";
import { parseISODateLocal, toISODateLocal } from "./utils/date";

const LABEL_COL_WIDTH = 60;
// Keep the pill inside the hour-label column. We align the line start to the
// pill's right edge so there's no white gap.
const NOW_PILL_RIGHT_INSET = spacing.sm; // align with hour-label paddingRight
const NOW_PILL_OVERFLOW_RIGHT = 3;
const NOW_LINE_JOIN_OVERLAP = 2;
const DEFAULT_ROW_H = 80;

const { width: SCREEN_W } = Dimensions.get("window");
const PAGER_RANGE = 5; // permite saltar hasta 5 días en un swipe
const PAGER_CENTER_INDEX = PAGER_RANGE;

export default function DayTimeline({ rowHeight = DEFAULT_ROW_H, initialDate }) {
  const { selectedISO, setSelectedISO, getLastSource } = useCalendarSelection();
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

  // Drives real-time updates of the "now" marker (line + pill label).
  // Without this, the marker would stay stuck at the time of the last render.
  const [nowTick, setNowTick] = useState(() => Date.now());

  const [cursorDate, setCursorDate] = useState(() => {
    const fromISO = parseISODateLocal(selectedISO);
    return fromISO || initialDate || startOfToday();
  });
  const cursorRef = useRef(cursorDate);
  cursorRef.current = cursorDate;

  const pageScrollRefs = useRef({});

  // Mantener la posición vertical (hora) consistente entre páginas/días.
  const lastScrollYRef = useRef(0);

  const isTodaySelected = useMemo(() => isSameDay(cursorDate, new Date()), [cursorDate]);

  useEffect(() => {
    if (!isTodaySelected) return;

    let intervalId;
    const timeoutId = setTimeout(() => {
      setNowTick(Date.now());
      intervalId = setInterval(() => setNowTick(Date.now()), 60_000);
    }, 60_000 - (Date.now() % 60_000));

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [isTodaySelected]);

  const nowY = useMemo(() => {
    if (!isTodaySelected) return null;
    void nowTick;
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    return (minutes / 60) * rowHeight;
  }, [isTodaySelected, rowHeight, nowTick]);

  const nowLabel = useMemo(() => {
    if (!isTodaySelected) return null;
    void nowTick;
    const now = new Date();
    const h12 = now.getHours() % 12 || 12;
    const mm = String(now.getMinutes()).padStart(2, "0");
    return `${h12}:${mm}`;
  }, [isTodaySelected, nowTick]);

  const scrollToNow = useCallback(
    (animated = true) => {
      if (!isTodaySelected) return;
      if (typeof nowY !== "number") return;
      const ref = pageScrollRefs.current?.d0;
      const targetY = Math.max(0, nowY - rowHeight * 1.2);
      ref?.scrollTo?.({ y: targetY, animated });
    },
    [isTodaySelected, nowY, rowHeight]
  );

  const handleTodayPress = useCallback(() => {
    const today = startOfToday();
    if (!isSameDay(cursorRef.current, today)) {
      setSelectedISO(toISODateLocal(today), "today_button");
      return;
    }
    scrollToNow(true);
  }, [setSelectedISO, scrollToNow]);

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

  // Durante el drag horizontal, pre-sincroniza la página vecina (d-1 o d+1)
  // para que no se vea que "arranca" en otra hora.
  const lastPreSyncDirRef = useRef(0);
  const lastPreSyncYRef = useRef(0);

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

  // Evitar saltos visuales: NO auto-scroll a "now" al cambiar de día.
  // Si quieres ir a la hora actual, el botón "Hoy" (cuando ya estás en hoy) lo hace.
  const didInitNowScrollRef = useRef(false);
  useEffect(() => {
    if (didInitNowScrollRef.current) return;
    if (!isTodaySelected) return;
    const source = getLastSource?.() || "unknown";
    if (source !== "init") return;
    didInitNowScrollRef.current = true;
    requestAnimationFrame(() => {
      scrollToNow(false);
    });
  }, [isTodaySelected, scrollToNow, getLastSource]);

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

    // Selección externa (por ejemplo, calendario compacto/extendido):
    // - Si viene del calendario: animar SIEMPRE exactamente 1 página (±1) hacia el día destino.
    // - Si viene de otros orígenes: animar dentro de rango ±5, si no, aterrizar directo.

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

      const rawDiff = differenceInCalendarDays(target, base);
      if (!rawDiff) return;

      // Para cualquier cambio EXTERNO (calendario, botón Hoy, etc.),
      // animamos exactamente 1 página (±1) y luego “aterrizamos” al target en onEnd.
      // Esto evita animaciones múltiples y mantiene un UX consistente.
      let delta = Math.sign(rawDiff);

      if (!delta) return;

      activeExternalTargetRef.current = { iso: pendingISO, seq };

      recenter();
      requestAnimationFrame(() => {
        if (activeExternalTargetRef.current?.seq !== seq) return;
        // Garantizado en rango: delta ∈ {-1,1} para calendar, o delta ∈ [-5..5] para otros.
        listRef.current?.scrollToIndex({
          index: PAGER_CENTER_INDEX + delta,
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

       // Mientras arrastras (sin soltar), la página vecina se empieza a ver antes de
       // que el índice "redondee" a 1. La sincronizamos continuamente.
      const centerX = SCREEN_W * PAGER_CENTER_INDEX;
      const dir = Math.sign(x - centerX); // -1 (izq) | 0 | 1 (der)
      if (dir !== 0) {
        const y = lastScrollYRef.current || 0;
        if (dir !== lastPreSyncDirRef.current || Math.abs(y - (lastPreSyncYRef.current || 0)) > 0.5) {
          lastPreSyncDirRef.current = dir;
          lastPreSyncYRef.current = y;
          const key = `d${dir}`;
          pageScrollRefs.current?.[key]?.scrollTo?.({ y, animated: false });
        }
      } else {
        lastPreSyncDirRef.current = 0;
      }

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

      // Pre-sincroniza el scroll vertical del target para que el swipe no muestre un salto.
      const key = `d${delta}`;
      const y = lastScrollYRef.current || 0;
      pageScrollRefs.current?.[key]?.scrollTo?.({ y, animated: false });
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
          cursorRef.current = target;
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
      cursorRef.current = nextCursor;
      setCursorDate(nextCursor);
      // Actualiza selección global: el calendario se mueve con esto.
      setSelectedISO(toISODateLocal(nextCursor), "timeline");
    },
    [recenter, setSelectedISO]
  );

  const renderItem = useCallback(
    ({ item }) => (
      <View style={[styles.page, { width: SCREEN_W }]}>
        <DayTimelinePage
          ref={(r) => {
            if (r) pageScrollRefs.current[item.key] = r;
          }}
          rowHeight={rowHeight}
          hours={hours}
          showNowLine={isTodaySelected && item.delta === 0}
          nowY={nowY}
          nowLabel={nowLabel}
          onScroll={(e) => {
            const y = e?.nativeEvent?.contentOffset?.y;
            if (typeof y === "number") lastScrollYRef.current = y;
          }}
          styles={styles}
        />
      </View>
    ),
    [hours, rowHeight, isTodaySelected, nowY, nowLabel]
  );

  return (
    <View style={styles.panContainer}>
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

      <View pointerEvents="box-none" style={styles.todayButtonLayer}>
        <Pressable
          onPress={handleTodayPress}
          style={({ pressed }) => [styles.todayButton, pressed && styles.todayButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Ir al día de hoy"
        >
          <Text style={styles.todayButtonText}>Hoy</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panContainer: {
    flex: 1,
    backgroundColor: colors.backgroundPrimary,
    position: "relative",
  },
  page: {
    flex: 1,
    backgroundColor: colors.backgroundPrimary,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.backgroundPrimary,
  },
  content: {
    paddingBottom: spacing.xl,
  },
  gridWrap: {
    position: "relative",
  },
  nowLineWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 24,
    justifyContent: "center",
  },
  nowLineRule: {
    position: "absolute",
    left:
      LABEL_COL_WIDTH -
      NOW_PILL_RIGHT_INSET +
      NOW_PILL_OVERFLOW_RIGHT -
      NOW_LINE_JOIN_OVERLAP,
    right: 0,
    height: 2,
    top: "50%",
    marginTop: -1,
    backgroundColor: colors.accentPrimary,
    opacity: 0.95,
  },
  nowPillWrap: {
    position: "absolute",
    left: 0,
    width: LABEL_COL_WIDTH,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingLeft: spacing.xs,
    paddingRight: NOW_PILL_RIGHT_INSET,
    overflow: "visible",
  },
  nowPill: {
    backgroundColor: colors.accentPrimary,
    paddingHorizontal: spacing.xs + 3,
    paddingVertical: 0,
    minHeight: 18,
    minWidth: 42,
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
    marginRight: -NOW_PILL_OVERFLOW_RIGHT,
  },
  nowPillText: {
    color: colors.backgroundPrimary,
    fontSize: 12,
    lineHeight: 13,
    fontWeight: "800",
    letterSpacing: 0,
    textAlign: "center",
    includeFontPadding: false,
    fontVariant: ["tabular-nums"],
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
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    alignItems: "flex-end",
  },
  hourLabelRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "flex-end",
    gap: 2,
  },
  // Place labels on the divider line (not inside the 15-min block), matching the
  // iOS-style day view where the hour label aligns with the hour line.
  hourLabelOnLine: {
    marginTop: -8,
  },
  hourNumberText: {
    fontSize: 15,
    lineHeight: 17,
    fontWeight: "600",
    color: colors.textPrimary,
    includeFontPadding: false,
  },
  hourSuffixText: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "600",
    color: colors.textMuted,
    opacity: 0.7,
    includeFontPadding: false,
  },
  minuteText: {
    fontSize: 9,
    fontWeight: "500",
    color: colors.textMuted,
    opacity: 0.65,
  },
  minuteTextOnLine: {
    marginTop: -7,
  },
  minuteLine: {
    flex: 1,
    height: 1,
    alignSelf: "flex-start",
    backgroundColor: colors.divider,
  },
  minuteLinePrimary: {
    opacity: 1,
  },
  minuteLineSecondary: {
    opacity: 0.22,
  },
  todayButtonLayer: {
    position: "absolute",
    bottom: spacing.lg,
    right: spacing.lg,
  },
  todayButton: {
    backgroundColor: colors.accentPrimary,
    borderRadius: 999,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
    shadowColor: colors.accentDark,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  todayButtonPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  todayButtonText: {
    color: colors.backgroundPrimary,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
});
