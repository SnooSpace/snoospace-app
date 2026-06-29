/**
 * components/location/MapLocationPicker.js
 *
 * Interactive full-screen map for confirming/adjusting a selected place.
 * Shown AFTER a place is selected in VenueSearchSheet (or via "Drop pin manually").
 *
 * Flow:
 *   1. Opens with camera animating to initialPlace coordinates
 *   2. Draggable marker dropped at the place
 *   3. User can drag marker / tap / long-press to reposition
 *   4. Every movement debounce-reverseGeocodes (300ms) → updates address live
 *   5. "Search this area" chip appears when camera drifts >500m from origin
 *   6. My Location FAB → moves camera + marker to user's GPS
 *   7. Confirm → calls onConfirm({ ...venueShape, manuallyAdjusted })
 *
 * Typography (SnooSpace global rules):
 *   - Bottom card venue name: BasicCommercial-Bold (section title)
 *   - Address / metadata: Manrope Regular/Medium
 *   - Buttons: Manrope SemiBold
 *
 * Icons: Lucide only
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Platform,
  Dimensions,
  StatusBar,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as ExpoLocation from 'expo-location';
import {
  ArrowLeft,
  MapPin,
  Navigation,
  Search,
  Check,
  LocateFixed,
} from 'lucide-react-native';
import { COLORS, FONTS, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { getActiveProvider, PROVIDER_NAME } from '../../services/location/index';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// How far the camera must drift from the original search point to show "Search this area"
const DRIFT_THRESHOLD_DEG = 0.005; // ~500m

/** Haversine distance between two coordinate pairs in degrees (cheap approximation) */
function coordDistance(a, b) {
  return Math.sqrt(
    Math.pow(a.latitude - b.latitude, 2) +
    Math.pow(a.longitude - b.longitude, 2),
  );
}

// ─── Attribution badge config ─────────────────────────────────────────────────
const ATTRIBUTION = {
  mappls: { label: 'Mappls', color: '#E63946' },
  google: { label: 'Google', color: '#4285F4' },
};

/**
 * @param {{
 *   visible: boolean,
 *   initialPlace: import('../../services/location/LocationService').UnifiedPlaceResult | null,
 *   userLocation: { lat: number, lng: number } | null,
 *   onBack: () => void,
 *   onConfirm: (venue: object) => void,
 * }} props
 */
export default function MapLocationPicker({
  visible,
  initialPlace,
  userLocation,
  onBack,
  onConfirm,
}) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const reverseDebounceRef = useRef(null);
  const originalCoordRef = useRef(null); // coordinate where search result landed

  // ── Map state ──────────────────────────────────────────────────────────────
  const [markerCoord, setMarkerCoord] = useState(null);
  const [cameraCenter, setCameraCenter] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // ── Address state (updates live while dragging) ────────────────────────────
  const [venueName, setVenueName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [venueShortAddress, setVenueShortAddress] = useState('');
  const [venueCity, setVenueCity] = useState('');
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);

  // ── Chip state ─────────────────────────────────────────────────────────────
  const [showSearchArea, setShowSearchArea] = useState(false);
  const [isSearchingArea, setIsSearchingArea] = useState(false);
  const [areaResults, setAreaResults] = useState([]);
  const [showAreaResults, setShowAreaResults] = useState(false);

  // ── My location FAB ────────────────────────────────────────────────────────
  const [isLocating, setIsLocating] = useState(false);

  // ── Whether pin was moved from original search coords ─────────────────────
  const [manuallyAdjusted, setManuallyAdjusted] = useState(false);

  // ── Chip fade animation ────────────────────────────────────────────────────
  const chipOpacity = useRef(new Animated.Value(0)).current;

  // ─── Initialise from initialPlace ──────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    const place = initialPlace;
    const lat = place?.lat ?? userLocation?.lat ?? 12.9716;
    const lng = place?.lng ?? userLocation?.lng ?? 77.5946;

    const coord = { latitude: lat, longitude: lng };
    setMarkerCoord(coord);
    setCameraCenter(coord);
    originalCoordRef.current = coord;
    setManuallyAdjusted(false);
    setShowSearchArea(false);
    setShowAreaResults(false);
    setAreaResults([]);

    // Populate address from place if available
    if (place) {
      setVenueName(place.name ?? '');
      setVenueAddress(place.address ?? '');
      setVenueShortAddress(place.shortAddress ?? '');
      setVenueCity('');
    } else {
      // Drop pin manually — reverse geocode default location
      setVenueName('');
      setVenueAddress('');
      setVenueShortAddress('');
      triggerReverseGeocode(lat, lng, true);
    }

    // Animate camera after modal is visible
    setTimeout(() => {
      mapRef.current?.animateToRegion({
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      }, 600);
    }, 350);
  }, [visible, initialPlace]);

  // ─── Reverse geocode (debounced) ───────────────────────────────────────────
  const triggerReverseGeocode = useCallback((lat, lng, immediate = false) => {
    if (reverseDebounceRef.current) {
      clearTimeout(reverseDebounceRef.current);
    }
    const delay = immediate ? 0 : 300;
    reverseDebounceRef.current = setTimeout(async () => {
      setIsLoadingAddress(true);
      try {
        const provider = getActiveProvider();
        const result = await provider.reverseGeocode(lat, lng);
        if (result) {
          setVenueAddress(result.address || '');
          setVenueShortAddress(result.shortAddress || '');
          setVenueCity(result.city || '');
          // Only replace venueName if it was empty (drop-pin flow)
          if (!initialPlace) {
            setVenueName(result.shortAddress || result.city || 'Selected Location');
          }
        }
      } catch {
        // best-effort
      } finally {
        setIsLoadingAddress(false);
      }
    }, delay);
  }, [initialPlace]);

  // Cleanup debounce on unmount
  useEffect(() => () => {
    if (reverseDebounceRef.current) clearTimeout(reverseDebounceRef.current);
  }, []);

  // ─── Marker drag handlers ───────────────────────────────────────────────────
  const handleMarkerDragStart = useCallback(() => {
    setIsDragging(true);
    setShowAreaResults(false);
  }, []);

  const handleMarkerDragEnd = useCallback((e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setIsDragging(false);
    setMarkerCoord({ latitude, longitude });
    setManuallyAdjusted(true);
    triggerReverseGeocode(latitude, longitude);
  }, [triggerReverseGeocode]);

  // ─── Map tap / long-press ───────────────────────────────────────────────────
  const handleMapPress = useCallback((e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setMarkerCoord({ latitude, longitude });
    setManuallyAdjusted(true);
    setShowAreaResults(false);
    triggerReverseGeocode(latitude, longitude);
  }, [triggerReverseGeocode]);

  const handleMapLongPress = useCallback((e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setMarkerCoord({ latitude, longitude });
    setManuallyAdjusted(true);
    setShowAreaResults(false);
    triggerReverseGeocode(latitude, longitude);
  }, [triggerReverseGeocode]);

  // ─── Camera region change → "Search this area" chip ───────────────────────
  const handleRegionChange = useCallback((region) => {
    setCameraCenter({ latitude: region.latitude, longitude: region.longitude });
    if (!originalCoordRef.current) return;
    const drift = coordDistance(
      { latitude: region.latitude, longitude: region.longitude },
      originalCoordRef.current,
    );
    setShowSearchArea(drift > DRIFT_THRESHOLD_DEG);
  }, []);

  // Chip fade in/out
  useEffect(() => {
    Animated.timing(chipOpacity, {
      toValue: showSearchArea ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [showSearchArea, chipOpacity]);

  // ─── "Search this area" ────────────────────────────────────────────────────
  const handleSearchThisArea = useCallback(async () => {
    if (!cameraCenter) return;
    setIsSearchingArea(true);
    setShowAreaResults(false);
    try {
      const provider = getActiveProvider();
      const results = await provider.searchPlaces('', {
        lat: cameraCenter.latitude,
        lng: cameraCenter.longitude,
        radius: 2000,
      });
      setAreaResults(results ?? []);
      setShowAreaResults(true);
      setShowSearchArea(false);
      originalCoordRef.current = cameraCenter;
    } catch {
      setAreaResults([]);
    } finally {
      setIsSearchingArea(false);
    }
  }, [cameraCenter]);

  const handleAreaResultPress = useCallback((result) => {
    const coord = { latitude: result.lat, longitude: result.lng };
    setMarkerCoord(coord);
    setVenueName(result.name);
    setVenueAddress(result.address);
    setVenueShortAddress(result.shortAddress);
    setManuallyAdjusted(false);
    originalCoordRef.current = coord;
    setShowAreaResults(false);
    mapRef.current?.animateToRegion({
      latitude: result.lat,
      longitude: result.lng,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    }, 400);
  }, []);

  // ─── My Location FAB ───────────────────────────────────────────────────────
  const handleMyLocation = useCallback(async () => {
    setIsLocating(true);
    try {
      let { status } = await ExpoLocation.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const result = await ExpoLocation.requestForegroundPermissionsAsync();
        status = result.status;
      }
      if (status !== 'granted') return;

      const loc = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.Balanced,
      });
      const { latitude, longitude } = loc.coords;
      const coord = { latitude, longitude };
      setMarkerCoord(coord);
      setManuallyAdjusted(true);
      originalCoordRef.current = coord;
      mapRef.current?.animateToRegion({
        latitude,
        longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 500);
      triggerReverseGeocode(latitude, longitude, true);
    } catch {
      // permission denied or location unavailable — fail silently
    } finally {
      setIsLocating(false);
    }
  }, [triggerReverseGeocode]);

  // ─── Confirm ───────────────────────────────────────────────────────────────
  const handleConfirm = useCallback(() => {
    if (!markerCoord) return;
    onConfirm({
      venueName: venueName || venueShortAddress || 'Selected Location',
      venueAddress: venueAddress,
      venueShortAddress: venueShortAddress,
      venueLat: markerCoord.latitude,
      venueLng: markerCoord.longitude,
      venueCity: venueCity,
      venueCategory: initialPlace?.category ?? null,
      venueProvider: initialPlace?.provider ?? PROVIDER_NAME,
      venueProviderId: initialPlace?.placeId ?? null,
      manuallyAdjusted,
      originalSearchLat: originalCoordRef.current?.latitude ?? markerCoord.latitude,
      originalSearchLng: originalCoordRef.current?.longitude ?? markerCoord.longitude,
    });
  }, [
    markerCoord, venueName, venueAddress, venueShortAddress, venueCity,
    initialPlace, manuallyAdjusted,
  ]);

  const attr = ATTRIBUTION[PROVIDER_NAME] ?? ATTRIBUTION.mappls;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onBack}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <View style={styles.root}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

        {/* ── Map ── */}
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: initialPlace?.lat ?? userLocation?.lat ?? 12.9716,
            longitude: initialPlace?.lng ?? userLocation?.lng ?? 77.5946,
            latitudeDelta: 0.008,
            longitudeDelta: 0.008,
          }}
          onPress={handleMapPress}
          onLongPress={handleMapLongPress}
          onRegionChange={handleRegionChange}
          mapType="standard"
          showsUserLocation={true}
          showsMyLocationButton={false}
          showsCompass={false}
          showsScale={false}
          showsTraffic={false}
          toolbarEnabled={false}
        >
          {markerCoord && (
            <Marker
              coordinate={markerCoord}
              draggable
              onDragStart={handleMarkerDragStart}
              onDragEnd={handleMarkerDragEnd}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={styles.markerContainer}>
                <View style={[styles.markerPin, isDragging && styles.markerPinDragging]}>
                  <MapPin size={18} color="#FFFFFF" strokeWidth={2.5} />
                </View>
                <View style={[styles.markerTail, isDragging && styles.markerTailDragging]} />
              </View>
            </Marker>
          )}
        </MapView>

        {/* ── Top bar (Back + title) ── */}
        <SafeAreaView style={styles.topBar} edges={['top']}>
          <View style={styles.topBarInner}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={onBack}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <ArrowLeft size={20} color={COLORS.textPrimary} strokeWidth={2} />
            </TouchableOpacity>
            <View style={styles.topBarTitlePill}>
              <MapPin size={13} color={COLORS.primary} strokeWidth={2} />
              <Text style={styles.topBarTitle} numberOfLines={1}>
                {venueName || 'Confirm location'}
              </Text>
            </View>
          </View>

          {/* ── "Search this area" chip ── */}
          <Animated.View style={[styles.searchAreaChipWrap, { opacity: chipOpacity }]}>
            <TouchableOpacity
              style={styles.searchAreaChip}
              onPress={handleSearchThisArea}
              disabled={isSearchingArea}
            >
              {isSearchingArea
                ? <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 4 }} />
                : <Search size={14} color={COLORS.primary} strokeWidth={2} />
              }
              <Text style={styles.searchAreaChipText}>Search this area</Text>
            </TouchableOpacity>
          </Animated.View>
        </SafeAreaView>

        {/* ── Area results list (mini overlay) ── */}
        {showAreaResults && areaResults.length > 0 && (
          <View style={[styles.areaResults, { top: insets.top + 100 }]}>
            {areaResults.slice(0, 5).map((r) => (
              <TouchableOpacity
                key={r.placeId}
                style={styles.areaResultRow}
                onPress={() => handleAreaResultPress(r)}
              >
                <MapPin size={14} color={COLORS.primary} strokeWidth={2} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.areaResultName} numberOfLines={1}>{r.name}</Text>
                  <Text style={styles.areaResultAddr} numberOfLines={1}>{r.shortAddress}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── My Location FAB ── */}
        <View style={[styles.fabContainer, { bottom: 240 + insets.bottom }]}>
          <TouchableOpacity
            style={styles.fab}
            onPress={handleMyLocation}
            disabled={isLocating}
          >
            {isLocating
              ? <ActivityIndicator size="small" color={COLORS.primary} />
              : <LocateFixed size={20} color={COLORS.primary} strokeWidth={2} />
            }
          </TouchableOpacity>
        </View>

        {/* ── Bottom confirmation card ── */}
        <View style={[styles.bottomCard, { paddingBottom: insets.bottom + 20 }]}>
          {/* Drag handle */}
          <View style={styles.handle} />

          {/* Venue info */}
          <View style={styles.venueRow}>
            <View style={styles.venueIconContainer}>
              <MapPin size={20} color={COLORS.primary} strokeWidth={2} />
            </View>
            <View style={styles.venueTextContainer}>
              {isLoadingAddress ? (
                <View style={{ gap: 6 }}>
                  <View style={styles.skeletonLine} />
                  <View style={[styles.skeletonLine, { width: '60%' }]} />
                </View>
              ) : (
                <>
                  <Text style={styles.venueName} numberOfLines={2}>
                    {venueName || venueShortAddress || 'Selected location'}
                  </Text>
                  {!!venueShortAddress && venueShortAddress !== venueName && (
                    <Text style={styles.venueAddr} numberOfLines={1}>
                      {venueShortAddress}
                    </Text>
                  )}
                  {!!venueAddress && (
                    <Text style={styles.venueFullAddr} numberOfLines={2}>
                      {venueAddress}
                    </Text>
                  )}
                </>
              )}
            </View>
          </View>

          {/* Attribution + manually adjusted badge */}
          <View style={styles.metaRow}>
            <View style={[styles.attrBadge, { backgroundColor: `${attr.color}18` }]}>
              <Text style={[styles.attrText, { color: attr.color }]}>
                {attr.label}
              </Text>
            </View>
            {manuallyAdjusted && (
              <View style={styles.adjustedBadge}>
                <Text style={styles.adjustedText}>Pin adjusted</Text>
              </View>
            )}
          </View>

          {/* Confirm button */}
          <TouchableOpacity
            style={[styles.confirmBtn, (!markerCoord || isLoadingAddress) && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={!markerCoord || isLoadingAddress}
          >
            <Check size={18} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.confirmBtnText}>Confirm Location</Text>
          </TouchableOpacity>

          {/* Hint */}
          <Text style={styles.hint}>
            Drag the pin or tap the map to adjust
          </Text>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#E8EDF2',
  },

  // ── Top bar ──
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },

  topBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 10,
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.sm,
  },

  topBarTitlePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...SHADOWS.sm,
  },

  topBarTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.textPrimary,
    flex: 1,
  },

  // ── "Search this area" chip ──
  searchAreaChipWrap: {
    alignItems: 'center',
    marginTop: 8,
  },

  searchAreaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    ...SHADOWS.md,
  },

  searchAreaChipText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.primary,
  },

  // ── Area results overlay ──
  areaResults: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    zIndex: 20,
    ...SHADOWS.md,
  },

  areaResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },

  areaResultName: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.textPrimary,
  },

  areaResultAddr: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },

  // ── Custom Marker ──
  markerContainer: {
    alignItems: 'center',
  },

  markerPin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.md,
  },

  markerPinDragging: {
    backgroundColor: '#1a4cc0',
    transform: [{ scale: 1.15 }],
  },

  markerTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: COLORS.primary,
    marginTop: -2,
  },

  markerTailDragging: {
    borderTopColor: '#1a4cc0',
  },

  // ── My Location FAB ──
  fabContainer: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
  },

  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.md,
  },

  // ── Bottom card ──
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    ...SHADOWS.large,
  },

  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: 16,
  },

  venueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },

  venueIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginTop: 2,
  },

  venueTextContainer: {
    flex: 1,
    gap: 2,
  },

  venueName: {
    fontFamily: FONTS.primary,  // BasicCommercial-Bold — section title role
    fontSize: 18,
    color: COLORS.textPrimary,
    lineHeight: 24,
  },

  venueAddr: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  venueFullAddr: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
    lineHeight: 17,
  },

  // Skeleton loading lines
  skeletonLine: {
    height: 14,
    borderRadius: 7,
    backgroundColor: '#E5E7EB',
    width: '80%',
  },

  // ── Meta row ──
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },

  attrBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },

  attrText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
  },

  adjustedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#FFF7ED',
  },

  adjustedText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: '#D97706',
  },

  // ── Confirm button ──
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    height: 52,
    marginBottom: 10,
  },

  confirmBtnDisabled: {
    opacity: 0.5,
  },

  confirmBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },

  hint: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 4,
  },
});
