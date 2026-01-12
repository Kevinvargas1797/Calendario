import React, { useEffect, useMemo, useRef } from "react";
import { View, Text, Pressable, Animated, Easing } from "react-native";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Ionicons } from "@expo/vector-icons"; // ✅ Expo

import { topBarStyles as styles } from "../styles";
import { capitalize } from "../utils/date";

export default function TopBar({
  date,
  expanded,
  onToggleMonth,
  onPrevWeek,
  onNextWeek,
}) {
  const topLabel = useMemo(
    () => capitalize(format(date, "EEE, d", { locale: es })),
    [date]
  );

  const bottomLabel = useMemo(
    () => capitalize(format(date, "MMM yyyy", { locale: es })),
    [date]
  );

  const rot = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(rot, {
      toValue: expanded ? 1 : 0,
      duration: 120,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [expanded, rot]);

  const rotate = rot.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  return (
    <View style={styles.root}>
      <Pressable onPress={onToggleMonth} style={styles.titleRow} hitSlop={10}>
        <View style={styles.titleTextBlock}>
          <Text style={styles.titleTop}>{topLabel}</Text>
          <Text style={styles.titleBottom}>{bottomLabel}</Text>
        </View>

        {/* ✅ Flecha profesional (icono real, giro perfecto) */}
        <Animated.View
          style={[styles.chevBox, { transform: [{ rotate }] }]}
          pointerEvents="none"
        >
          <Ionicons
            name="chevron-down"
            size={22}
            color="#6B7280"
          />
        </Animated.View>
      </Pressable>

      <View style={styles.navBtns}>
        <Pressable onPress={onPrevWeek} style={styles.navBtn} hitSlop={8}>
          <Text style={styles.navBtnText}>‹</Text>
        </Pressable>
        <Pressable onPress={onNextWeek} style={styles.navBtn} hitSlop={8}>
          <Text style={styles.navBtnText}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}
