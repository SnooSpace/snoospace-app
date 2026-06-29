/**
 * components/location/MiniMapPreview.js
 *
 * Static (non-interactive) map thumbnail displayed wherever a selected venue
 * is shown in the app: Event Creation review, Plan detail, etc.
 *
 * Features:
 *  - Full-width, configurable height (default 140px)
 *  - Rounded top corners (premium card feel)
 *  - Non-draggable marker at venue coordinates
 *  - All gestures disabled — gestures are disabled so the map is purely visual
 *  - Tap → opens Google Maps deeplink for the venue
 *
 * Uses react-native-maps (already installed, v1.27.2)
 *
 * Typography: Manrope only (this is metadata/helper text)
 * Icons: Lucide only
 */

import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { MapPin, ExternalLink } from 'lucide-react-native';
import { COLORS, FONTS, BORDER_RADIUS, SHADOWS } from '../../constants/theme';

/**
 * @param {{
 *   lat: number,
 *   lng: number,
 *   name?: string,
 *   shortAddress?: string,
 *   height?: number,
 *   borderRadius?: number,
 *   style?: object,
 *   showOpenButton?: boolean,
 * }} props
 */
export default function MiniMapPreview({
  lat,
  lng,
  name,
  shortAddress,
  height = 140,
  borderRadius = 14,
  style,
  showOpenButton = false,
}) {
  const mapRef = useRef(null);

  if (!lat || !lng) return null;

  const openGoogleMaps = () => {
    const query = name ? encodeURIComponent(name) : `${lat},${lng}`;
    const url = Platform.select({
      ios: `maps:?q=${query}&ll=${lat},${lng}`,
      android: `geo:${lat},${lng}?q=${query}`,
      default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    });
    Linking.openURL(url).catch(() => {
      // Fallback to Google Maps web
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
    });
  };

  return (
    <TouchableOpacity
      style={[styles.container, { height, borderRadius }, style]}
      onPress={openGoogleMaps}
      activeOpacity={0.9}
    >
      {/* Map */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        mapType="standard"
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        showsTraffic={false}
        showsBuildings={false}
        showsIndoors={false}
        liteMode={true}  // Android: uses static map tile (faster, no interaction)
      >
        <Marker
          coordinate={{ latitude: lat, longitude: lng }}
          anchor={{ x: 0.5, y: 1 }}
        >
          {/* Custom marker */}
          <View style={styles.markerContainer}>
            <View style={styles.markerDot}>
              <MapPin size={14} color="#FFFFFF" strokeWidth={2.5} />
            </View>
            <View style={styles.markerTail} />
          </View>
        </Marker>
      </MapView>

      {/* Gradient overlay at bottom */}
      <View style={[styles.gradient, { borderRadius }]} pointerEvents="none" />

      {/* Open in Maps button */}
      {showOpenButton && (
        <View style={styles.openButton}>
          <ExternalLink size={12} color="#FFFFFF" strokeWidth={2} />
          <Text style={styles.openButtonText}>Open in Maps</Text>
        </View>
      )}

      {/* Tap hint overlay */}
      <View style={[styles.tapHint, { borderRadius }]}>
        <ExternalLink size={14} color={COLORS.textSecondary} strokeWidth={2} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#E8EDF2',
    ...SHADOWS.sm,
  },

  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },

  // ── Custom Marker ──
  markerContainer: {
    alignItems: 'center',
  },

  markerDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.sm,
  },

  markerTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: COLORS.primary,
    marginTop: -1,
  },

  // ── Open in Maps button (optional) ──
  openButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },

  openButtonText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: '#FFFFFF',
  },

  // ── Tap hint ──
  tapHint: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
