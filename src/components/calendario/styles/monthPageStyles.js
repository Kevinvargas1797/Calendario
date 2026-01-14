import { StyleSheet } from "react-native";
import { colors } from "../../../theme";
import { DAY_CIRCLE, DAY_FONT, H_PADDING, MONTH_CELL_H, SCREEN_W } from "./constants";

export const monthPageStyles = StyleSheet.create({
  monthPage: {
    width: SCREEN_W,
    paddingHorizontal: H_PADDING,
    paddingTop: 0,
    paddingBottom: 0,
  },
  monthRow: {
    flexDirection: "row",
  },
  monthDayCell: {
    flex: 1,
    height: MONTH_CELL_H,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 0,
  },
  monthDayCircle: {
    width: DAY_CIRCLE,
    height: DAY_CIRCLE,
    borderRadius: DAY_CIRCLE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  monthDayCircleSelected: {
    backgroundColor: colors.accentDark,
  },
  monthDayCircleSelectedToday: {
    backgroundColor: colors.accentPrimary,
  },
  monthDayCircleToday: {
    borderWidth: 2,
    borderColor: colors.accentPrimary,
  },
  monthDayText: {
    fontSize: DAY_FONT,
    fontWeight: "800",
    color: colors.textPrimary,
    lineHeight: DAY_FONT + 3,
  },
  monthDayTextSelected: {
    color: colors.backgroundPrimary,
  },
  monthDayTextToday: {
    color: colors.accentPrimary,
  },
  monthDayTextMuted: {
    color: colors.textMuted,
  },
});
