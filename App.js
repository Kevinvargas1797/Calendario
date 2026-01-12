import { SafeAreaView, StyleSheet, StatusBar, View } from "react-native";
import Calendario from "./src/components/calendario/Calendario";
import DayTimeline from "./src/components/agenda/DayTimeline";
import { colors, spacing } from "./src/theme";

const App = () => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.calendarBlock}>
        <Calendario
          onChangeDate={(iso) => {
            console.log("Fecha seleccionada:", iso);
          }}
        />
      </View>

      <View style={styles.timelineBlock}>
        <DayTimeline />
      </View>
    </SafeAreaView>
  );
};

export default App;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundPrimary,
    paddingTop: spacing.sm,
  },
  calendarBlock: {
    flexShrink: 0,
  },
  timelineBlock: {
    flex: 1,
  },
});
