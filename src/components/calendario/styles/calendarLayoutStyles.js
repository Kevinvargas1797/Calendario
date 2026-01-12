import { StyleSheet } from "react-native";
import { colors, spacing } from "../../../theme";
import { H_PADDING, LINE_COLOR } from "./constants";

export const calendarLayoutStyles = StyleSheet.create({
  container: {
    paddingTop: spacing.sm,
    backgroundColor: colors.backgroundPrimary,
  },
  weekSection: {
    flexGrow: 0,
    flexShrink: 0,
  },
  bottomBorder: {
    height: 1,
    backgroundColor: LINE_COLOR,
    alignSelf: "stretch",
    marginHorizontal: H_PADDING,
    marginTop: spacing.xs,
  },
  gripHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: LINE_COLOR,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  gripHandlePressed: {
    opacity: 0.6,
  },
});
