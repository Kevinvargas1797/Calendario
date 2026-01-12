import React from "react";
import { View, Text } from "react-native";
import { headerRowStyles as styles } from "../styles";

export default function HeaderRow({ dow }) {
  return (
    <View style={styles.root}>
      {dow.map((d) => (
        <Text key={d} style={styles.text}>
          {d}
        </Text>
      ))}
    </View>
  );
}
