import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { View, Animated, Pressable, ScrollView } from "react-native";
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
  const ignoreMomentumUntilRef = useRef(0);

  // 3 páginas fijas: usamos ScrollView para evitar reciclado/virtualización del FlatList.
  const pages = useMemo(() => {
    const cur = startOfMonth(cursorMonth);
    const prev = addMonths(cur, -1);
    const next = addMonths(cur, 1);
    return {
      prev: { key: "prev", monthStartISO: toISODate(prev) },
      cur: { key: "cur", monthStartISO: toISODate(cur) },
      next: { key: "next", monthStartISO: toISODate(next) },
    };
  }, [cursorMonth]);

  const scrollRef = useRef(null);

  const recenterToMiddle = useCallback(() => {
    scrollRef.current?.scrollTo({ x: SCREEN_W, y: 0, animated: false });
  }, []);

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
          // En algunos devices RN dispara onMomentumScrollEnd extra después del recenter.
          ignoreMomentumUntilRef.current = Date.now() + 300;
          recenterToMiddle();
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

  const onEnd = (e) => {
    if (isResettingRef.current) return;

    const now = Date.now();
    if (now < ignoreMomentumUntilRef.current) return;

    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / SCREEN_W);

    if (idx === 1) return;

    // Bloquea inmediatamente: el recenter puede disparar otro onEnd.
    isResettingRef.current = true;
    ignoreMomentumUntilRef.current = Date.now() + 350;

    const dir = idx === 2 ? 1 : -1;
    const cur = cursorRef.current;
    const nextCursor = addMonths(cur, dir);

    // Hacemos el recenter y el commit del mes en el MISMO tick para evitar
    // un frame intermedio donde el panel está centrado pero con el mes anterior.
    recenterToMiddle();
    cursorRef.current = nextCursor;
    setCursorMonth(nextCursor);
    onMonthChange?.(nextCursor);

    requestAnimationFrame(() => {
      isResettingRef.current = false;
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
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            bounces={false}
            overScrollMode="never"
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onMomentumScrollEnd={onEnd}
          >
            <View style={{ width: SCREEN_W }}>
              <MonthPage
                item={pages.prev}
                selectedDate={selectedDate}
                onPickDay={(day) => {
                  onPickDay?.(day);
                  requestAnimationFrame(() => closeInstant());
                }}
              />
            </View>

            <View style={{ width: SCREEN_W }}>
              <MonthPage
                item={pages.cur}
                selectedDate={selectedDate}
                onPickDay={(day) => {
                  onPickDay?.(day);
                  requestAnimationFrame(() => closeInstant());
                }}
              />
            </View>

            <View style={{ width: SCREEN_W }}>
              <MonthPage
                item={pages.next}
                selectedDate={selectedDate}
                onPickDay={(day) => {
                  onPickDay?.(day);
                  requestAnimationFrame(() => closeInstant());
                }}
              />
            </View>
          </ScrollView>
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
