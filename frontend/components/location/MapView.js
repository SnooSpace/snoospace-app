import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentLocation } from '../../utils/location';

const PRIMARY_COLOR = '#5f27cd';
const TEXT_COLOR = '#1e1e1e';

export default function LocationMapView({ 
  initialLocation,
  onLocationChange,
  draggable = true,
}) {
  const [region, setRegion] = useState({
    latitude: initialLocation?.lat || 37.7749,
    longitude: initialLocation?.lng || -122.4194,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  const [markerLocation, setMarkerLocation] = useState({
    latitude: initialLocation?.lat || 37.7749,
    longitude: initialLocation?.lng || -122.4194,
  });

  useEffect(() => {
    if (initialLocation?.lat && initialLocation?.lng) {
      const newRegion = {
        latitude: initialLocation.lat,
        longitude: initialLocation.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setRegion(newRegion);
      setMarkerLocation({
        latitude: initialLocation.lat,
        longitude: initialLocation.lng,
      });
    }
  }, [initialLocation]);

  const handleMarkerDragEnd = (e) => {
    const newLocation = e.nativeEvent.coordinate;
    setMarkerLocation(newLocation);
    if (onLocationChange) {
      onLocationChange({
        lat: newLocation.latitude,
        lng: newLocation.longitude,
      });
    }
  };

  const handleRecenter = async () => {
    const currentLoc = await getCurrentLocation();
    if (currentLoc) {
      const newRegion = {
        latitude: currentLoc.lat,
        longitude: currentLoc.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setRegion(newRegion);
      setMarkerLocation({
        latitude: currentLoc.lat,
        longitude: currentLoc.lng,
      });
      if (onLocationChange) {
        onLocationChange(currentLoc);
      }
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation={true}
        showsMyLocationButton={false}
      >
        <Marker
          coordinate={markerLocation}
          draggable={draggable}
          onDragEnd={handleMarkerDragEnd}
          pinColor={PRIMARY_COLOR}
        />
      </MapView>
      
      <TouchableOpacity
        style={styles.recenterButton}
        onPress={handleRecenter}
      >
        <Ionicons name="locate" size={24} color={PRIMARY_COLOR} />
      </TouchableOpacity>
      
      {draggable && (
        <View style={styles.instructionContainer}>
          <Text style={styles.instructionText}>
            Drag the pin to your business location
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  recenterButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  instructionContainer: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 12,
    borderRadius: 8,
  },
  instructionText: {
    fontSize: 12,
    color: TEXT_COLOR,
    textAlign: 'center',
  },
});

