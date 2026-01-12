import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { View, FlatList, Animated, Pressable } from "react-native";
import { monthModalStyles as styles, SCREEN_W, MONTH_CELL_H, calendarLayoutStyles as layoutStyles } from "../styles";
import { spacing } from "../../../theme";
import MonthPage from "./MonthPage";
import { addMonths, startOfMonth, toISODate } from "../utils/date";

export default function MonthModal({
  visible,
  onClose,
  selectedDate,
  onPickDay,
  anchorY = 0,
  initialMonthStart, // Date
  onMonthChange, // (newMonthStart: Date) => void
}) {
  const [mounted, setMounted] = useState(visible);
  const closingRef = useRef(false);

  const monthGridH = useMemo(() => 6 * MONTH_CELL_H, []);
  const panelExtraH = useMemo(
    () => (spacing.xs + 4 + spacing.xs) + (spacing.xs + 1),
    []
  );
  const calendarH = useMemo(() => monthGridH + panelExtraH, [monthGridH, panelExtraH]);
  const animH = useRef(new Animated.Value(0)).current;

  // cursor del mes (siempre startOfMonth)
  const [cursorMonth, setCursorMonth] = useState(() =>
    startOfMonth(initialMonthStart || new Date())
  );
  const cursorRef = useRef(cursorMonth);
  useEffect(() => {
    cursorRef.current = cursorMonth;
  }, [cursorMonth]);

  // evita doble-trigger cuando reciclamos al centro
  const isResettingRef = useRef(false);

  // 3 páginas (prev/current/next)
  const data = useMemo(() => {
    const cur = cursorMonth;
    const prev = addMonths(cur, -1);
    const next = addMonths(cur, 1);
    return [
      { key: toISODate(prev), monthStartISO: toISODate(prev) },
      { key: toISODate(cur), monthStartISO: toISODate(cur) },
      { key: toISODate(next), monthStartISO: toISODate(next) },
    ];
  }, [cursorMonth]);

  const listRef = useRef(null);

  const openInstant = () => {
    closingRef.current = false;
    animH.stopAnimation();
    animH.setValue(calendarH); // PUM
  };

  const closeInstant = () => {
    if (closingRef.current) return;
    closingRef.current = true;

    animH.stopAnimation();
    animH.setValue(0); // PUM
    setMounted(false);
    onClose?.();
  };

  // al abrir, sincroniza cursor al mes del selected
  useEffect(() => {
    if (visible) {
      setMounted(true);

      const m = startOfMonth(initialMonthStart || selectedDate || new Date());
      setCursorMonth(m);

      requestAnimationFrame(() => {
        openInstant();
        requestAnimationFrame(() => {
          isResettingRef.current = true;
          listRef.current?.scrollToIndex({ index: 1, animated: false });
          requestAnimationFrame(() => {
            isResettingRef.current = false;
          });
        });
      });
    } else {
      if (mounted) closeInstant();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const renderMonth = useCallback(
    ({ item }) => (
      <MonthPage
        item={item}
        selectedDate={selectedDate}
        onPickDay={(day) => {
          onPickDay?.(day);
          requestAnimationFrame(() => closeInstant());
        }}
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedDate, onPickDay]
  );

  const getLayout = useCallback((_, index) => {
    return { length: SCREEN_W, offset: SCREEN_W * index, index };
  }, []);

  const onEnd = (e) => {
    if (isResettingRef.current) return;

    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / SCREEN_W);

    if (idx === 1) return;

    const dir = idx === 2 ? 1 : -1;
    const cur = cursorRef.current;
    const nextCursor = addMonths(cur, dir);

    // actualiza cursor
    cursorRef.current = nextCursor;
    setCursorMonth(nextCursor);

    // notifica para sincronizar compacto (header/semana/selección)
    onMonthChange?.(nextCursor);

    // recicla al centro (sin disparar loops)
    requestAnimationFrame(() => {
      isResettingRef.current = true;
      listRef.current?.scrollToIndex({ index: 1, animated: false });
      requestAnimationFrame(() => {
        isResettingRef.current = false;
      });
    });
  };

  if (!mounted) return null;

  return (
    <View style={styles.overlayRoot} pointerEvents="box-none">
      <Pressable style={styles.overlayBackdrop} onPress={closeInstant} />

      <Animated.View
        style={[
          styles.modalPanel,
          { top: anchorY, height: animH, overflow: "hidden" },
        ]}
      >
        <View style={{ height: monthGridH }}>
          <FlatList
            ref={listRef}
            data={data}
            horizontal
            pagingEnabled
            disableIntervalMomentum
            bounces={false}
            overScrollMode="never"
            showsHorizontalScrollIndicator={false}
            keyExtractor={(it) => it.key}
            renderItem={renderMonth}
            getItemLayout={getLayout}
            initialScrollIndex={1}
            onMomentumScrollEnd={onEnd}
            // ultra-virtualización (aunque solo son 3 items)
            windowSize={3}
            initialNumToRender={1}
            maxToRenderPerBatch={1}
            updateCellsBatchingPeriod={16}
            removeClippedSubviews
            scrollEventThrottle={16}
          />
        </View>

        <Pressable
          onPress={closeInstant}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Contraer calendario"
          accessibilityHint="Toca para cerrar el calendario mensual"
          style={({ pressed }) => [
            layoutStyles.gripHandle,
            pressed && layoutStyles.gripHandlePressed,
          ]}
        />
        <View style={layoutStyles.bottomBorder} />
      </Animated.View>
    </View>
  );
}
