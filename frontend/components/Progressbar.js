import React from 'react';
import { View, StyleSheet } from 'react-native';

const ProgressBar = ({ progress }) => {
  return (
    <View style={styles.container}>
      <View style={[styles.active, { width: `${progress}%` }]} />
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
    backgroundColor: '#5f27cd', // same PRIMARY_COLOR
    borderRadius: 2,
  },
  inactive: {
    flex: 1,
    height: '100%',
  },
});

export default ProgressBar;
