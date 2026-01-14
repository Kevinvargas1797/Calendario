import React, { memo, useEffect, useMemo, useRef } from "react";
import { View, Text, Pressable, FlatList, Animated, Easing } from "react-native";
import { format, isSameDay, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { weekPagerStyles as styles, SCREEN_W } from "../styles";
import { buildWeekDays, parseISODate, toISODate } from "../utils/date";

const DayCell = memo(
  function DayCell({ date, selectedDate, onSelectDate }) {
    const isSel = isSameDay(date, selectedDate);
    const isT = isToday(date);

    const scale = useRef(new Animated.Value(isSel ? 1 : 0.92)).current;
    const fade = useRef(new Animated.Value(isSel ? 1 : 0.98)).current;

    useEffect(() => {
      if (isSel) {
        scale.setValue(0.88);
        fade.setValue(0.9);

        Animated.parallel([
          Animated.spring(scale, {
            toValue: 1,
            stiffness: 280,
            damping: 18,
            mass: 0.7,
            useNativeDriver: true,
          }),
          Animated.timing(fade, {
            toValue: 1,
            duration: 120,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1,
            duration: 120,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(fade, {
            toValue: 1,
            duration: 120,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      }
    }, [isSel, scale, fade]);

    return (
      <Pressable
        onPress={() => onSelectDate(date)}
        style={({ pressed }) => [styles.dayCell, pressed && styles.dayCellPressed]}
      >
        <Animated.View style={{ transform: [{ scale }], opacity: fade }}>
          <View
            style={[
              styles.dayCircle,
              isSel && (isT ? styles.dayCircleSelectedToday : styles.dayCircleSelected),
            ]}
          >
            <Text
              style={[
                styles.dayNumber,
                isSel && styles.dayNumberSelected,
                !isSel && isT && styles.dayNumberToday,
              ]}
            >
              {format(date, "d", { locale: es })}
            </Text>
          </View>
        </Animated.View>

        {!isSel && isT ? <View style={styles.todayDot} /> : <View style={styles.dotSpacer} />}
      </Pressable>
    );
  },
  (prev, next) => {
    const prevIsSel = isSameDay(prev.date, prev.selectedDate);
    const nextIsSel = isSameDay(next.date, next.selectedDate);
    return prev.date.getTime() === next.date.getTime() && prevIsSel === nextIsSel;
  }
);

export default function WeekPager({
  weeks,
  listRef,
  selectedDate,
  onSelectDate,
  initialIndex,
  onIndexChange, // (idx, fromSwipe:boolean) => void
}) {
  const getWeekItemLayout = useMemo(
    () => (_, index) => ({
      length: SCREEN_W,
      offset: SCREEN_W * index,
      index,
    }),
    []
  );

  const renderWeek = ({ item }) => {
    const weekStart = parseISODate(item.weekStartISO);
    const days = buildWeekDays(weekStart);

    return (
      <View style={[styles.page, { width: SCREEN_W }]}>
        <View style={styles.daysRow}>
          {days.map((d) => (
            <DayCell
              key={toISODate(d)}
              date={d}
              selectedDate={selectedDate}
              onSelectDate={onSelectDate}
            />
          ))}
        </View>
      </View>
    );
  };

  return (
    <FlatList
      ref={listRef}
      data={weeks}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      keyExtractor={(it) => it.key}
      renderItem={renderWeek}
      getItemLayout={getWeekItemLayout}
      initialScrollIndex={initialIndex}
      onMomentumScrollEnd={(e) => {
        const x = e.nativeEvent.contentOffset.x;
        const idx = Math.round(x / SCREEN_W);
        onIndexChange(idx, true); // ✅ desde swipe
      }}
      onScrollToIndexFailed={() => {
        listRef.current?.scrollToIndex({
          index: Math.floor(weeks.length / 2),
          animated: false,
        });
      }}
    />
  );
}
