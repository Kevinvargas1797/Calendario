import { StyleSheet } from "react-native";
import { colors, spacing, typography } from "../../../theme";
import { H_PADDING } from "./constants";

export const topBarStyles = StyleSheet.create({
  root: {
    paddingBottom: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: H_PADDING * 3,
  },
  titleTextBlock: {
    flexDirection: "column",
    justifyContent: "center",
  },
  titleTop: {
    ...typography.titleLg,
    lineHeight: 20,
  },
  titleBottom: {
    ...typography.subtitle,
    marginTop: 2,
    lineHeight: 16,
  },
  chevBox: {
    width: 32,
    height: 32,
    marginLeft: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  navBtns: {
    flexDirection: "row",
    columnGap: spacing.sm + 2,
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.backgroundMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  navBtnText: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.textPrimary,
    lineHeight: 22,
  },
});
