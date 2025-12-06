import { Linking, Platform, Alert } from 'react-native';

/**
 * Opens Google Maps app for navigation to the given location
 * @param {string|Object} location - Google Maps URL (preferred) OR Location object with lat, lng
 * @returns {Promise<boolean>} - Whether the app was opened successfully
 */
export const openMapsNavigation = async (location) => {
  try {
    // Priority 1: If it's a Google Maps URL, open it directly
    if (typeof location === 'string') {
      // Check if it's a valid Google Maps URL
      if (location.includes('maps.google') || 
          location.includes('goo.gl') || 
          location.includes('g.co/maps')) {
        const supported = await Linking.canOpenURL(location);
        if (supported) {
          await Linking.openURL(location);
          return true;
        }
      }
      
      // Fallback: treat as search query
      const webUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
      await Linking.openURL(webUrl);
      return true;
    }
    
    // Priority 2: Handle legacy coordinate objects (backward compatibility)
    if (typeof location === 'object' && location !== null) {
      const { lat, lng, address } = location;
      
      if (!lat || !lng) {
        Alert.alert('Error', 'Invalid location coordinates');
        return false;
      }

      // Platform-specific URL schemes
      let url;
      
      if (Platform.OS === 'ios') {
        // Try Google Maps app first, fallback to Apple Maps
        url = `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`;
        
        const canOpen = await Linking.canOpenURL(url);
        if (!canOpen) {
          // Fallback to Apple Maps
          url = `maps://?daddr=${lat},${lng}`;
        }
      } else {
        // Android - use geo: URI for best compatibility
        const label = address ? encodeURIComponent(address) : 'Event Location';
        url = `geo:${lat},${lng}?q=${lat},${lng}(${label})`;
      }

      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        return true;
      } else {
        // Fallback to web browser
        const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
        await Linking.openURL(webUrl);
        return true;
      }
    }
    
    Alert.alert('Error', 'Invalid location format');
    return false;
  } catch (error) {
    console.error('Error opening maps:', error);
    Alert.alert('Error', 'Could not open maps application');
    return false;
  }
};

/**
 * Opens Google Maps to show a location (without navigation)
 * @param {Object|string} location - Location object with lat, lng OR location string
 * @returns {Promise<boolean>} - Whether the app was opened successfully
 */
export const openMapsLocation = async (location) => {
  try {
    let lat, lng, address;
    
    if (typeof location === 'string') {
      const webUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
      await Linking.openURL(webUrl);
      return true;
    }
    
    if (typeof location === 'object' && location !== null) {
      lat = location.lat;
      lng = location.lng;
      address = location.address;
    }

    if (!lat || !lng) {
      Alert.alert('Error', 'Invalid location coordinates');
      return false;
    }

    const label = address ? encodeURIComponent(address) : 'Location';
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${label}`;
    
    await Linking.openURL(url);
    return true;
  } catch (error) {
    console.error('Error opening maps:', error);
    Alert.alert('Error', 'Could not open maps application');
    return false;
  }
};
