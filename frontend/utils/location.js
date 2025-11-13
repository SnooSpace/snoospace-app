// GPS location helper functions using expo-location

import * as Location from 'expo-location';

/**
 * Request location permissions
 * @returns {Promise<boolean>} True if permission granted
 */
export async function requestLocationPermission() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error requesting location permission:', error);
    return false;
  }
}

/**
 * Check if location permissions are granted
 * @returns {Promise<boolean>} True if permission granted
 */
export async function hasLocationPermission() {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error checking location permission:', error);
    return false;
  }
}

/**
 * Get current GPS location
 * @param {Object} options - Location options
 * @returns {Promise<Object|null>} Location object with lat, lng or null
 */
export async function getCurrentLocation(options = {}) {
  try {
    const hasPermission = await hasLocationPermission();
    if (!hasPermission) {
      const granted = await requestLocationPermission();
      if (!granted) {
        return null;
      }
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
      timeout: 15000,
      maximumAge: 10000,
      ...options,
    });

    return {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
    };
  } catch (error) {
    console.error('Error getting current location:', error);
    return null;
  }
}

