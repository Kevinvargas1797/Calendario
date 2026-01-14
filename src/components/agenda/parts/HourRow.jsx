import React, { memo } from "react";
import { Text, View } from "react-native";

import { formatHourParts } from "../utils/date";
const MINUTE_MARKS = [0, 15, 30, 45];

const HourRow = memo(function HourRow({ hour, rowH, styles }) {
  const minuteHeight = rowH / MINUTE_MARKS.length;

  return (
    <View style={[styles.row, { height: rowH }]}>
      {MINUTE_MARKS.map((minute) => {
        const isHourLine = minute === 0;
        const hourParts = isHourLine ? formatHourParts(hour) : null;

        return (
          <View
            key={`${hour}-${minute}`}
            style={[
              styles.minuteRow,
              { height: minuteHeight, alignItems: isHourLine ? "flex-start" : "center" },
            ]}
          >
            <View style={styles.labelCol}>
              {isHourLine ? (
                <View style={[styles.hourLabelRow, styles.hourLabelOnLine]}>
                  <Text style={styles.hourNumberText}>{hourParts.hour}</Text>
                  <Text style={styles.hourSuffixText}>{hourParts.suffix}</Text>
                </View>
              ) : (
                <Text style={[styles.minuteText, styles.minuteTextOnLine]}>
                  {minute.toString().padStart(2, "0")}
                </Text>
              )}
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

export default HourRow;
