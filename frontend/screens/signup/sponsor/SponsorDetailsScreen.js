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

const SponsorDetailsScreen = ({ navigation, route }) => {
  const { email, accessToken } = route.params || {};
  const [formData, setFormData] = useState({
    brandName: '',
    bio: '',
    phone: '',
    requirements: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    const { brandName, bio, phone, requirements } = formData;
    
    if (!brandName || !bio || !phone || !requirements) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    setLoading(true);
    setError("");
    
    try {
      await apiPost("/sponsors/signup", {
        brandName,
        bio,
        email,
        phone,
        requirements,
      }, 8000);
      
      Alert.alert(
        "Success", 
        "Sponsor account created successfully!",
        [{ text: "OK", onPress: () => navigation.navigate("SponsorHome") }]
      );
    } catch (e) {
      setError(e.message || "Failed to create sponsor account.");
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
        <Text style={styles.headerTitle}>Sponsor Details</Text>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.title}>Tell us about your brand</Text>
        <Text style={styles.subtitle}>
          Help us understand your sponsorship needs.
        </Text>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Brand Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter brand name"
              value={formData.brandName}
              onChangeText={(value) => handleInputChange('brandName', value)}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Bio *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe your brand"
              value={formData.bio}
              onChangeText={(value) => handleInputChange('bio', value)}
              multiline
              numberOfLines={4}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Phone Number *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter phone number"
              value={formData.phone}
              onChangeText={(value) => handleInputChange('phone', value)}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Requirements *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="What are your sponsorship requirements?"
              value={formData.requirements}
              onChangeText={(value) => handleInputChange('requirements', value)}
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
            <Text style={styles.buttonText}>Create Sponsor Account</Text>
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
    height: 100,
    textAlignVertical: 'top',
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

export default SponsorDetailsScreen;
