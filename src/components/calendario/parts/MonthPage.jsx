import React, { memo, useMemo } from "react";
import { View, Pressable, Text } from "react-native";
import { format, isSameDay, isSameMonth, isToday } from "date-fns";
import { es } from "date-fns/locale";

import { monthPageStyles as styles } from "../styles";
import { parseISODate, toISODate, getMonthGridDays } from "../utils/date";

function MonthPage({ item, selectedDate, onPickDay }) {
  const monthStart = useMemo(
    () => parseISODate(item.monthStartISO),
    [item.monthStartISO]
  );

  const gridDays = useMemo(() => getMonthGridDays(monthStart), [monthStart]); // 42

  return (
    <View style={styles.monthPage}>
      {Array.from({ length: 6 }).map((_, row) => {
        const rowDays = gridDays.slice(row * 7, row * 7 + 7);

        return (
          <View key={`row-${row}`} style={styles.monthRow}>
            {rowDays.map((d) => {
              const inMonth = isSameMonth(d, monthStart);

              // ✅ CORRECCIÓN:
              // Se puede seleccionar cualquier día (incluidos los "grises"),
              // PERO solo se pinta como "selected" si el selectedDate pertenece al mes visible.
              const isSel =
                isSameDay(d, selectedDate) &&
                isSameMonth(selectedDate, monthStart);

              const isT = isToday(d);

              return (
                <Pressable
                  key={toISODate(d)}
                  // ✅ El usuario SÍ puede seleccionarlos aunque no sean del mes
                  onPress={() => onPickDay?.(d)}
                  style={({ pressed }) => [
                    styles.monthDayCell,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <View
                    style={[
                      styles.monthDayCircle,
                      isSel && (isT ? styles.monthDayCircleSelectedToday : styles.monthDayCircleSelected),
                      !isSel && isT && styles.monthDayCircleToday,
                    ]}
                  >
                    <Text
                      style={[
                        styles.monthDayText,
                        !inMonth && styles.monthDayTextMuted, // se ven “gris”
                        isSel && styles.monthDayTextSelected,
                        !isSel && isT && styles.monthDayTextToday,
                      ]}
                    >
                      {format(d, "d", { locale: es })}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

export default memo(
  MonthPage,
  (prev, next) =>
    prev.item.monthStartISO === next.item.monthStartISO &&
    prev.selectedDate?.getTime?.() === next.selectedDate?.getTime?.()
);
