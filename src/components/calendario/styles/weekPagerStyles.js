import { StyleSheet } from "react-native";
import { colors } from "../../../theme";
import { DAY_CIRCLE, DAY_FONT, H_PADDING } from "./constants";

export const weekPagerStyles = StyleSheet.create({
  page: {
    paddingHorizontal: H_PADDING,
  },
  daysRow: {
    flexDirection: "row",
  },
  dayCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
  dayCellPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  dayCircle: {
    width: DAY_CIRCLE,
    height: DAY_CIRCLE,
    borderRadius: DAY_CIRCLE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  dayCircleSelected: {
    backgroundColor: colors.accentDark,
  },
  dayNumber: {
    fontSize: DAY_FONT,
    fontWeight: "800",
    color: colors.textPrimary,
    lineHeight: DAY_FONT + 3,
  },
  dayNumberSelected: {
    color: colors.backgroundPrimary,
  },
  dayNumberToday: {
    color: colors.accentPrimary,
  },
  todayDot: {
    width: 0,
    height: 0,
  },
  dotSpacer: {
    width: 0,
    height: 0,
  },
});
