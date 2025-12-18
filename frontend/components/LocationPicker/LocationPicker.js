import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentLocation, hasLocationPermission, requestLocationPermission } from '../../utils/location';
import { reverseGeocodeStructured } from '../../utils/geocoding';
import LocationConfirmationModal from './LocationConfirmationModal';
import AddressSearchBar from './AddressSearchBar';
import LocationMapView from './MapView';
import ConfirmationScreen from './ConfirmationScreen';
import { COLORS } from '../../constants/theme';

// Local constants removed in favor of theme constants

export default function LocationPicker({ 
  businessName,
  initialLocation,
  onLocationSelected,
  onCancel,
}) {
  const [step, setStep] = useState('loading'); // 'loading', 'confirm', 'manual', 'final'
  const [currentLocation, setCurrentLocation] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(initialLocation || null);
  const [displayAddress, setDisplayAddress] = useState('');
  const [isAtBusiness, setIsAtBusiness] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);

  useEffect(() => {
    initializeLocation();
  }, []);

  const initializeLocation = async () => {
    try {
      setIsLoading(true);
      const hasPermission = await hasLocationPermission();
      
      if (!hasPermission) {
        const granted = await requestLocationPermission();
        if (!granted) {
          Alert.alert(
            'Location Permission',
            'Location permission is required. Please enable it in settings.',
            [
              { text: 'OK', onPress: () => {
                setStep('manual');
                setIsLoading(false);
              }},
            ]
          );
          return;
        }
      }

      const location = await getCurrentLocation();
      if (location) {
        setCurrentLocation(location);
        setSelectedLocation(location);
        
        // Reverse geocode to get address
        setIsLoadingAddress(true);
        const addressData = await reverseGeocodeStructured(location.lat, location.lng);
        setDisplayAddress(addressData.address || '');
        setSelectedLocation({
          ...location,
          ...addressData,
        });
        setIsLoadingAddress(false);
        
        // Show confirmation modal
        if (businessName) {
          setStep('confirm');
        } else {
          // No business name, go directly to manual selection
          setStep('manual');
        }
      } else {
        Alert.alert(
          'Location Error',
          'Could not get your location. Please select manually.',
          [{ text: 'OK', onPress: () => setStep('manual') }]
        );
      }
    } catch (error) {
      console.error('Error initializing location:', error);
      Alert.alert(
        'Error',
        'Failed to get your location. Please select manually.',
        [{ text: 'OK', onPress: () => setStep('manual') }]
      );
      setStep('manual');
    } finally {
      setIsLoading(false);
    }
  };

  const handleYesImHere = () => {
    setIsAtBusiness(true);
    setStep('final');
  };

  const handleNoSomewhereElse = () => {
    setIsAtBusiness(false);
    setStep('manual');
  };

  const handleLocationFromSearch = async (location) => {
    setSelectedLocation(location);
    // Reverse geocode to ensure we have full address
    setIsLoadingAddress(true);
    try {
      const addressData = await reverseGeocodeStructured(location.lat, location.lng);
      setSelectedLocation({
        ...location,
        ...addressData,
      });
      setDisplayAddress(addressData.address || location.address || '');
    } catch (error) {
      console.error('Error reverse geocoding:', error);
    } finally {
      setIsLoadingAddress(false);
    }
  };

  const handleMapLocationChange = async (location) => {
    setSelectedLocation(prev => ({
      ...prev,
      ...location,
    }));
    // Reverse geocode when pin is dragged
    setIsLoadingAddress(true);
    try {
      const addressData = await reverseGeocodeStructured(location.lat, location.lng);
      setSelectedLocation(prev => ({
        ...prev,
        ...addressData,
      }));
      setDisplayAddress(addressData.address || '');
    } catch (error) {
      console.error('Error reverse geocoding:', error);
    } finally {
      setIsLoadingAddress(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    const location = await getCurrentLocation();
    if (location) {
      setIsLoadingAddress(true);
      try {
        const addressData = await reverseGeocodeStructured(location.lat, location.lng);
        setSelectedLocation({
          ...location,
          ...addressData,
        });
        setDisplayAddress(addressData.address || '');
      } catch (error) {
        console.error('Error reverse geocoding:', error);
      } finally {
        setIsLoadingAddress(false);
      }
    }
  };

  const handleConfirmLocation = () => {
    if (selectedLocation && selectedLocation.lat && selectedLocation.lng) {
      onLocationSelected(selectedLocation);
    } else {
      Alert.alert('Error', 'Please select a valid location');
    }
  };

  const handleEditLocation = () => {
    setStep('manual');
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Getting your location...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'confirm') {
    return (
      <LocationConfirmationModal
        visible={true}
        businessName={businessName}
        onYes={handleYesImHere}
        onNo={handleNoSomewhereElse}
      />
    );
  }

  if (step === 'final') {
    return (
      <SafeAreaView style={styles.container}>
        <ConfirmationScreen
          location={selectedLocation}
          onEdit={handleEditLocation}
          onConfirm={handleConfirmLocation}
        />
      </SafeAreaView>
    );
  }

  // Manual selection step
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Select Business Location</Text>
        </View>

        <View style={styles.content}>
          {/* AddressSearchBar removed for community signup - only works for US, not India */}

          <View style={styles.mapSection}>
            {selectedLocation && (
              <LocationMapView
                initialLocation={selectedLocation}
                onLocationChange={handleMapLocationChange}
                draggable={true}
              />
            )}
          </View>

          {isLoadingAddress && (
            <View style={styles.loadingAddressContainer}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.loadingAddressText}>Getting address...</Text>
            </View>
          )}

          {displayAddress && !isLoadingAddress && (
            <View style={styles.addressDisplay}>
              <Ionicons name="location" size={20} color={COLORS.primary} />
              <Text style={styles.addressText} numberOfLines={2}>
                {displayAddress}
              </Text>
            </View>
          )}

          <Text style={styles.instructionText}>
            Drag the pin to your business location or search above
          </Text>

          <TouchableOpacity
            style={styles.useCurrentButton}
            onPress={handleUseCurrentLocation}
          >
            <Ionicons name="locate-outline" size={20} color={COLORS.primary} />
            <Text style={styles.useCurrentButtonText}>Use My Current Location</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.confirmButton,
            (!selectedLocation || !selectedLocation.lat) && styles.disabledButton
          ]}
          onPress={() => {
            if (selectedLocation && selectedLocation.lat) {
              setStep('final');
            }
          }}
          disabled={!selectedLocation || !selectedLocation.lat}
        >
          <Text style={styles.confirmButtonText}>Confirm Location</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background || '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20, // Keep horizontal padding
    paddingTop: 0, // Reduced from 20 to 10
    paddingBottom: 5, // Reduced from 10 to 5
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 10,
  },
  mapSection: {
    marginTop: 20,
    marginBottom: 16,
  },
  loadingAddressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 8,
  },
  loadingAddressText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  addressDisplay: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  instructionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  useCurrentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    backgroundColor: '#f8f9fa',
    gap: 8,
    marginBottom: 20,
  },
  useCurrentButtonText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  footer: {
    padding: 20,
    backgroundColor: COLORS.background || '#ffffff',
    borderTopWidth: 1,
    borderTopColor: COLORS.border || '#e9ecef',
  },
  confirmButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

