/**
 * components/location/VenueSearchSheet.js  [REWRITE v2]
 *
 * Enhanced venue/place search sheet with:
 *  - 📍 Use My Current Location (always first row)
 *  - 📌 Drop pin manually (second row — opens map at current GPS / default city)
 *  - Recent Searches (last 10, from AsyncStorage, hidden while typing)
 *  - Nearby Places (category pills: Restaurants / Cafes / Colleges / Parks / Metro)
 *  - Search Results (debounced, with query cache for 7-day TTL)
 *
 * Attribution (required by both APIs): "Powered by Mappls/Google" badge.
 *
 * Typography (SnooSpace global rules):
 *   - Header title: BasicCommercial-Bold
 *   - Section labels: Manrope SemiBold
 *   - Result names: Manrope SemiBold
 *   - Addresses / metadata: Manrope Regular / Medium
 *   - Buttons: Manrope SemiBold
 *
 * Icons: Lucide only
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Dimensions,
  Keyboard,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ExpoLocation from 'expo-location';
import {
  Search,
  X,
  MapPin,
  Navigation2,
  Clock,
  LocateFixed,
  Crosshair,
  ChevronRight,
} from 'lucide-react-native';

import { COLORS, FONTS, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { getActiveProvider, PROVIDER_NAME } from '../../services/location/index';
import { useLocationSearch } from '../../services/location/useLocationSearch';
import {
  getRecents,
  saveRecent,
  buildCacheKey,
  getQueryCache,
  saveQueryCache,
} from '../../services/location/searchCache';
import PlaceResultItem from './PlaceResultItem';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Attribution badge config ─────────────────────────────────────────────────
const ATTRIBUTION = {
  mappls: { label: 'Powered by Mappls', color: '#E63946', bg: '#FFF1F2' },
  google: { label: 'Powered by Google', color: '#4285F4', bg: '#EEF2FF' },
};

// ─── Nearby category pills ────────────────────────────────────────────────────
const NEARBY_CATEGORIES = [
  { key: 'restaurant', label: '🍽 Restaurants' },
  { key: 'cafe',       label: '☕ Cafes'       },
  { key: 'college',    label: '🎓 Colleges'    },
  { key: 'park',       label: '🌳 Parks'       },
  { key: 'metro',      label: '🚇 Metro'       },
  { key: 'bar',        label: '🍸 Bars'        },
  { key: 'gym',        label: '💪 Gyms'        },
];

/**
 * @param {{
 *   visible: boolean,
 *   onClose: () => void,
 *   onSelect: (result: import('../../services/location/LocationService').UnifiedPlaceResult) => void,
 *   onDropPin?: () => void,        — called when "Drop pin manually" is tapped
 *   title?: string,
 *   initialQuery?: string,
 *   userLocation?: { lat: number, lng: number } | null,
 *   showNearby?: boolean,
 * }} props
 */
export default function VenueSearchSheet({
  visible,
  onClose,
  onSelect,
  onDropPin,
  title = 'Search for a venue',
  initialQuery = '',
  userLocation = null,
  showNearby = true,
}) {
  const inputRef = useRef(null);

  // ── Search hook ──────────────────────────────────────────────────────────
  const {
    query,
    setQuery,
    results,
    loading: searchLoading,
    error: searchError,
    setUserLocation,
  } = useLocationSearch({ debounceMs: 350 });

  // ── Local state ──────────────────────────────────────────────────────────
  const [recents, setRecents] = useState([]);
  const [nearbyResults, setNearbyResults] = useState([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [currentLocationResult, setCurrentLocationResult] = useState(null);

  // ── Sync userLocation into search hook ───────────────────────────────────
  useEffect(() => {
    setUserLocation(userLocation);
  }, [userLocation, setUserLocation]);

  // ── On open: reset, load recents, load nearby ────────────────────────────
  useEffect(() => {
    if (!visible) return;
    setQuery(initialQuery ?? '');
    setActiveCategory(null);
    setCurrentLocationResult(null);

    // Load recents from AsyncStorage
    getRecents().then(setRecents).catch(() => setRecents([]));

    // Auto-focus
    const t = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, [visible]);

  // Load nearby on open if userLocation available
  const loadNearby = useCallback(async (category = null) => {
    if (!userLocation) return;
    setNearbyLoading(true);
    try {
      const provider = getActiveProvider();
      const res = await provider.nearbySearch(
        userLocation.lat,
        userLocation.lng,
        { radius: 2000, ...(category ? { category } : {}) },
      );
      setNearbyResults(res ?? []);
    } catch {
      setNearbyResults([]);
    } finally {
      setNearbyLoading(false);
    }
  }, [userLocation]);

  useEffect(() => {
    if (visible && showNearby && userLocation) {
      loadNearby(null);
    } else if (!visible) {
      setNearbyResults([]);
    }
  }, [visible, showNearby, userLocation, loadNearby]);

  const handleCategoryPress = useCallback((key) => {
    const next = activeCategory === key ? null : key;
    setActiveCategory(next);
    loadNearby(next);
  }, [activeCategory, loadNearby]);

  // ── Persist recent + query cache after search results arrive ─────────────
  useEffect(() => {
    if (query.trim().length >= 2 && results?.length > 0) {
      saveRecent(query.trim(), results);
      const key = buildCacheKey(
        PROVIDER_NAME,
        query.trim(),
        userLocation?.lat ?? 12.9716,
        userLocation?.lng ?? 77.5946,
      );
      saveQueryCache(key, results);
    }
  }, [results]);

  // ── Current location row ─────────────────────────────────────────────────
  const handleUseCurrentLocation = useCallback(async () => {
    setIsLocating(true);
    try {
      let { status } = await ExpoLocation.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const r = await ExpoLocation.requestForegroundPermissionsAsync();
        status = r.status;
      }
      if (status !== 'granted') { setIsLocating(false); return; }

      const loc = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.Balanced,
      });
      const { latitude, longitude } = loc.coords;
      const provider = getActiveProvider();
      const geo = await provider.reverseGeocode(latitude, longitude);

      const result = {
        placeId: `current_${latitude}_${longitude}`,
        name: geo?.shortAddress || 'Current Location',
        address: geo?.address || '',
        shortAddress: geo?.shortAddress || '',
        lat: latitude,
        lng: longitude,
        category: null,
        provider: PROVIDER_NAME,
      };

      setCurrentLocationResult(result);
      Keyboard.dismiss();
      onSelect(result);
      onClose();
    } catch {
      // silently fail — location unavailable
    } finally {
      setIsLocating(false);
    }
  }, [onSelect, onClose]);

  // ── Select a result ──────────────────────────────────────────────────────
  const handleSelect = useCallback((item) => {
    Keyboard.dismiss();
    onSelect(item);
    onClose();
  }, [onSelect, onClose]);

  const handleClear = useCallback(() => {
    setQuery('');
    inputRef.current?.focus();
  }, [setQuery]);

  const handleDropPin = useCallback(() => {
    Keyboard.dismiss();
    onClose();
    onDropPin?.();
  }, [onClose, onDropPin]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const isQuerying = query.trim().length >= 2;
  const attr = ATTRIBUTION[PROVIDER_NAME] ?? ATTRIBUTION.mappls;

  // ── List sections ────────────────────────────────────────────────────────
  const listSections = useMemo(() => {
    if (isQuerying) {
      return [{ type: 'results', data: results }];
    }
    const sections = [];
    if (recents.length > 0) {
      sections.push({ type: 'recents', data: recents });
    }
    if (nearbyResults.length > 0) {
      sections.push({ type: 'nearby', data: nearbyResults });
    }
    return sections;
  }, [isQuerying, results, recents, nearbyResults]);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <X size={20} color={COLORS.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* ── Search bar ── */}
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Search size={18} color={COLORS.textMuted} strokeWidth={2} />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              placeholder="Search venues, areas, landmarks…"
              placeholderTextColor={COLORS.textMuted}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={handleClear}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={16} color={COLORS.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Attribution badge ── */}
        <View style={styles.attributionRow}>
          <View style={[styles.attributionBadge, { backgroundColor: attr.bg }]}>
            <Text style={[styles.attributionText, { color: attr.color }]}>
              {attr.label}
            </Text>
          </View>
        </View>

        {/* ── Fixed action rows (always visible above list) ── */}
        <View style={styles.actionRows}>
          {/* Use My Current Location */}
          <TouchableOpacity
            style={styles.actionRow}
            onPress={handleUseCurrentLocation}
            disabled={isLocating}
          >
            <View style={styles.actionIconContainer}>
              {isLocating
                ? <ActivityIndicator size="small" color={COLORS.primary} />
                : <LocateFixed size={18} color={COLORS.primary} strokeWidth={2} />
              }
            </View>
            <Text style={styles.actionLabel}>
              {isLocating ? 'Getting your location…' : 'Use My Current Location'}
            </Text>
            <ChevronRight size={16} color={COLORS.textMuted} strokeWidth={2} />
          </TouchableOpacity>

          <View style={styles.actionDivider} />

          {/* Drop pin manually */}
          {onDropPin && (
            <>
              <TouchableOpacity style={styles.actionRow} onPress={handleDropPin}>
                <View style={[styles.actionIconContainer, { backgroundColor: '#F3F4F6' }]}>
                  <Crosshair size={18} color={COLORS.textSecondary} strokeWidth={2} />
                </View>
                <Text style={[styles.actionLabel, { color: COLORS.textSecondary }]}>
                  Drop pin manually
                </Text>
                <ChevronRight size={16} color={COLORS.textMuted} strokeWidth={2} />
              </TouchableOpacity>
              <View style={styles.actionDivider} />
            </>
          )}
        </View>

        {/* ── Nearby category pills (only when not querying) ── */}
        {!isQuerying && showNearby && userLocation && (
          <View style={styles.categorySection}>
            <Text style={styles.sectionLabel}>Nearby</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryPills}
            >
              {NEARBY_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.key}
                  style={[
                    styles.categoryPill,
                    activeCategory === cat.key && styles.categoryPillActive,
                  ]}
                  onPress={() => handleCategoryPress(cat.key)}
                >
                  <Text style={[
                    styles.categoryPillText,
                    activeCategory === cat.key && styles.categoryPillTextActive,
                  ]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Content ── */}
        {(searchLoading || (nearbyLoading && !isQuerying)) ? (
          <View style={styles.inlineLoader}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.loadingText}>
              {nearbyLoading && !isQuerying ? 'Finding nearby places…' : 'Searching…'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={[]} // we render sections manually via ListHeaderComponent
            keyExtractor={() => 'empty'}
            renderItem={null}
            ListHeaderComponent={
              <>
                {listSections.map((section, idx) => {
                  if (section.type === 'recents') {
                    return (
                      <View key="recents">
                        <Text style={styles.sectionLabel}>Recent Searches</Text>
                        {section.data.map((recent, ri) => (
                          <TouchableOpacity
                            key={`recent-${ri}`}
                            style={styles.recentRow}
                            onPress={() => setQuery(recent.query)}
                          >
                            <Clock size={15} color={COLORS.textMuted} strokeWidth={2} />
                            <Text style={styles.recentQuery} numberOfLines={1}>
                              {recent.query}
                            </Text>
                            {recent.results?.[0] && (
                              <Text style={styles.recentMeta} numberOfLines={1}>
                                {recent.results[0].shortAddress}
                              </Text>
                            )}
                          </TouchableOpacity>
                        ))}
                      </View>
                    );
                  }

                  if (section.type === 'nearby') {
                    return (
                      <View key="nearby">
                        <View style={styles.sectionHeaderRow}>
                          <Navigation2 size={14} color={COLORS.primary} strokeWidth={2} />
                          <Text style={[styles.sectionLabel, { color: COLORS.primary, marginBottom: 0 }]}>
                            {activeCategory
                              ? NEARBY_CATEGORIES.find((c) => c.key === activeCategory)?.label ?? 'Nearby'
                              : 'Nearby Places'}
                          </Text>
                        </View>
                        {section.data.map((item) => (
                          <PlaceResultItem
                            key={`${item.provider}-${item.placeId}`}
                            item={item}
                            onPress={handleSelect}
                          />
                        ))}
                      </View>
                    );
                  }

                  if (section.type === 'results') {
                    if (section.data.length === 0) {
                      return (
                        <View key="empty-results" style={styles.emptyState}>
                          <MapPin size={32} color={COLORS.textMuted} strokeWidth={1.5} />
                          <Text style={styles.emptyTitle}>No results found</Text>
                          <Text style={styles.emptySubtitle}>Try a different name or area</Text>
                        </View>
                      );
                    }
                    return (
                      <View key="results">
                        {section.data.map((item) => (
                          <PlaceResultItem
                            key={`${item.provider}-${item.placeId}`}
                            item={item}
                            onPress={handleSelect}
                          />
                        ))}
                      </View>
                    );
                  }

                  return null;
                })}

                {/* Default empty state — nothing to show */}
                {listSections.length === 0 && !isQuerying && (
                  <View style={styles.emptyState}>
                    <Search size={32} color={COLORS.textMuted} strokeWidth={1.5} />
                    <Text style={styles.emptyTitle}>Start typing to search</Text>
                    <Text style={styles.emptySubtitle}>
                      Search for venues, restaurants, parks and more
                    </Text>
                  </View>
                )}
              </>
            }
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },

  headerTitle: {
    fontFamily: FONTS.primary,
    fontSize: 20,
    color: COLORS.textPrimary,
    flex: 1,
    marginRight: 12,
  },

  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Search ──
  searchRow: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.screenBackground,
    borderRadius: BORDER_RADIUS.m,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    gap: 8,
  },

  searchInput: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textPrimary,
    padding: 0,
  },

  // ── Attribution ──
  attributionRow: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    alignItems: 'flex-start',
  },

  attributionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },

  attributionText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
  },

  // ── Action rows ──
  actionRows: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },

  actionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },

  actionLabel: {
    flex: 1,
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.primary,
  },

  actionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginHorizontal: 14,
  },

  // ── Category pills ──
  categorySection: {
    paddingTop: 12,
    paddingBottom: 4,
  },

  categoryPills: {
    paddingHorizontal: 16,
    gap: 8,
    paddingVertical: 4,
  },

  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },

  categoryPillActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#EEF2FF',
  },

  categoryPillText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  categoryPillTextActive: {
    color: COLORS.primary,
  },

  // ── Section labels ──
  sectionLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },

  // ── Recents ──
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },

  recentQuery: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.textPrimary,
    flex: 1,
  },

  recentMeta: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    maxWidth: 100,
  },

  // ── Inline loader ──
  inlineLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 32,
  },

  loadingText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.textSecondary,
  },

  // ── Empty state ──
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
    gap: 8,
  },

  emptyTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginTop: 8,
  },

  emptySubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
