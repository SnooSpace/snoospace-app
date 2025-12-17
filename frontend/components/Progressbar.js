import { View, StyleSheet } from 'react-native';
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "../constants/theme";

const ProgressBar = ({ progress }) => {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={COLORS.primaryGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.active, { width: `${progress}%` }]}
      />
      <View style={styles.inactive} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e9ecef',
    overflow: 'hidden',
    flexDirection: 'row',
  },
  active: {
    height: '100%',
    borderRadius: 2,
  },
  inactive: {
    flex: 1,
    height: '100%',
  },
});

export default ProgressBar;
