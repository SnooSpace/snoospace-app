import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiPost } from '../../../api/client';

const VenueDetailsScreen = ({ navigation, route }) => {
  const { email, accessToken } = route.params || {};
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    contactName: '',
    contactPhone: '',
    capacityMin: '',
    capacityMax: '',
    pricePerHead: '',
    conditions: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    const { name, address, city, contactName, contactPhone, capacityMin, capacityMax, pricePerHead, conditions } = formData;
    
    if (!name || !address || !city || !contactName || !contactPhone || !capacityMin || !capacityMax || !pricePerHead) {
      Alert.alert("Error", "Please fill in all required fields.");
      return;
    }

    setLoading(true);
    setError("");
    
    try {
      await apiPost("/venues/signup", {
        name,
        address,
        city,
        contactName,
        contactEmail: email,
        contactPhone,
        capacityMin: parseInt(capacityMin),
        capacityMax: parseInt(capacityMax),
        pricePerHead: parseFloat(pricePerHead),
        conditions: conditions || '',
      }, 8000);
      
      Alert.alert(
        "Success", 
        "Venue account created successfully!",
        [{ text: "OK", onPress: () => navigation.navigate("VenueHome") }]
      );
    } catch (e) {
      setError(e.message || "Failed to create venue account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#1D2A32" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Venue Details</Text>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.title}>Tell us about your venue</Text>
        <Text style={styles.subtitle}>
          Help us understand your venue's capabilities.
        </Text>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Venue Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter venue name"
              value={formData.name}
              onChangeText={(value) => handleInputChange('name', value)}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Address *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Enter full address"
              value={formData.address}
              onChangeText={(value) => handleInputChange('address', value)}
              multiline
              numberOfLines={2}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>City *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter city"
              value={formData.city}
              onChangeText={(value) => handleInputChange('city', value)}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Contact Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter contact person name"
              value={formData.contactName}
              onChangeText={(value) => handleInputChange('contactName', value)}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Contact Phone *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter contact phone"
              value={formData.contactPhone}
              onChangeText={(value) => handleInputChange('contactPhone', value)}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputContainer, styles.halfWidth]}>
              <Text style={styles.label}>Min Capacity *</Text>
              <TextInput
                style={styles.input}
                placeholder="50"
                value={formData.capacityMin}
                onChangeText={(value) => handleInputChange('capacityMin', value)}
                keyboardType="numeric"
              />
            </View>
            <View style={[styles.inputContainer, styles.halfWidth]}>
              <Text style={styles.label}>Max Capacity *</Text>
              <TextInput
                style={styles.input}
                placeholder="200"
                value={formData.capacityMax}
                onChangeText={(value) => handleInputChange('capacityMax', value)}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Price per Head *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter price per person"
              value={formData.pricePerHead}
              onChangeText={(value) => handleInputChange('pricePerHead', value)}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Conditions (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Any special conditions or requirements"
              value={formData.conditions}
              onChangeText={(value) => handleInputChange('conditions', value)}
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Create Venue Account</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  backButton: {
    paddingRight: 15,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1D2A32',
  },
  content: {
    flex: 1,
    paddingHorizontal: 25,
    paddingTop: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1D2A32',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#6c757d',
    marginBottom: 30,
  },
  form: {
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1D2A32',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    width: '48%',
  },
  button: {
    backgroundColor: '#5f27cd',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 30,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  errorText: {
    color: '#dc3545',
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
  },
});

export default VenueDetailsScreen;
