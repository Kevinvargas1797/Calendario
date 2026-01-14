import React, { memo, forwardRef } from "react";
import { ScrollView, View, Text } from "react-native";

import HourRow from "./HourRow";

const DayTimelinePage = memo(
  forwardRef(function DayTimelinePage(
    { rowHeight, hours, showNowLine, nowY, nowLabel, onScroll, styles },
    ref
  ) {
    const NOW_H = 20;

    return (
      <ScrollView
        ref={ref}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.gridWrap}>
          {hours.map((h) => (
            <HourRow key={h} hour={h} rowH={rowHeight} styles={styles} />
          ))}

          {showNowLine && typeof nowY === "number" && (
            <View
              pointerEvents="none"
              style={[styles.nowLineWrap, { top: nowY - NOW_H / 2, height: NOW_H }]}
            >
              <View style={styles.nowLineRule} />
              <View style={styles.nowPillWrap}>
                <View style={styles.nowPill}>
                  <Text style={styles.nowPillText}>{nowLabel || ""}</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    );
  })
);

DayTimelinePage.displayName = "DayTimelinePage";

export default DayTimelinePage;
