import { StyleSheet } from "react-native";
import { spacing, typography } from "../../../theme";
import { H_PADDING } from "./constants";

export const headerRowStyles = StyleSheet.create({
  root: {
    flexDirection: "row",
    paddingHorizontal: H_PADDING,
    paddingBottom: spacing.xs,
  },
  text: {
    flex: 1,
    textAlign: "center",
    ...typography.caption,
  },
});
