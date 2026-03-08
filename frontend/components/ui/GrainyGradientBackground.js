import React from 'react';
import { StyleSheet, ImageBackground } from 'react-native';

/**
 * GrainyGradientBackground
 *
 * Uses a static image from the assets folder as the background.
 * Place your image at `assets/orangish.png`.
 */
export default function GrainyGradientBackground({ children }) {
  return (
    <ImageBackground
      source={require('../../assets/tealish.png')}
      style={styles.container}
      resizeMode="cover"
    >
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#eef1f5', // Fallback color while loading
  },
});
