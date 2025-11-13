import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LocationMapView from './MapView';

const PRIMARY_COLOR = '#5f27cd';
const TEXT_COLOR = '#1e1e1e';
const LIGHT_TEXT_COLOR = '#6c757d';
const BACKGROUND_COLOR = '#ffffff';

export default function ConfirmationScreen({ 
  location,
  onEdit,
  onConfirm,
}) {
  if (!location || !location.lat || !location.lng) {
    return null;
  }

  const addressText = location.address || 
    [location.city, location.state, location.country].filter(Boolean).join(', ') ||
    'Address not available';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Confirm Location</Text>
      
      <View style={styles.mapContainer}>
        <LocationMapView
          initialLocation={location}
          draggable={false}
        />
      </View>

      <View style={styles.addressContainer}>
        <Ionicons 
          name="location" 
          size={24} 
          color={PRIMARY_COLOR} 
          style={styles.icon}
        />
        <View style={styles.addressTextContainer}>
          <Text style={styles.addressText}>{addressText}</Text>
          {location.city && (
            <Text style={styles.locationDetails}>
              {[location.city, location.state, location.country]
                .filter(Boolean)
                .join(', ')}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.editButton]}
          onPress={onEdit}
        >
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.confirmButton]}
          onPress={onConfirm}
        >
          <Text style={styles.confirmButtonText}>Confirm</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: TEXT_COLOR,
    marginBottom: 20,
  },
  mapContainer: {
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  icon: {
    marginRight: 12,
    marginTop: 2,
  },
  addressTextContainer: {
    flex: 1,
  },
  addressText: {
    fontSize: 16,
    fontWeight: '500',
    color: TEXT_COLOR,
    marginBottom: 4,
    lineHeight: 22,
  },
  locationDetails: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  editButtonText: {
    color: TEXT_COLOR,
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: PRIMARY_COLOR,
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

