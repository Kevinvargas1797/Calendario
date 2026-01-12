import { StyleSheet } from "react-native";
import { colors } from "./colors";

export const typography = StyleSheet.create({
  titleLg: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.textSecondary,
  },
  caption: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  numberMd: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.textPrimary,
  },
});
