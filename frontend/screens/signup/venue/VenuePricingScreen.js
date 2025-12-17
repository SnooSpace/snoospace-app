import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Platform,
  StatusBar,
} from 'react-native';
// Removed all external imports to resolve compilation issues.

import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../../constants/theme";
import { Ionicons } from "@expo/vector-icons";

// Reusable component for the pricing input fields (allow one decimal)
const PricingInput = ({ title, placeholder, unit, value, onChangeText }) => {
  const [isFocused, setIsFocused] = useState(false);
  
  // Allow digits only - no decimal formatting
  const handleTextChange = (text) => {
    const sanitized = text.replace(/\D/g, ''); // digits only
    onChangeText(sanitized);
  };
  
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{title}</Text>
      <View style={[styles.inputContainer, isFocused && styles.inputFocused]}>
        <Text style={styles.currencySymbol}>₹</Text>
        <TextInput
          style={styles.textInput}
          onChangeText={handleTextChange}
          value={value}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textSecondary}
          keyboardType="number-pad"
          // Allow empty input for better UX
          defaultValue=""
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        {unit && <Text style={styles.unitText}>{unit}</Text>}
      </View>
    </View>
  );
};



// Main Screen Component
const EventPricingScreen = ({ navigation, route }) => {
  const { email, accessToken, name, address, city, phone, capacity_max, price_per_head: prefillPrice, category, logo_url, bio, interests } = route.params || {};
  // Use strings for state to manage decimal input cleanly
  const [pricePerHead, setPricePerHead] = useState(prefillPrice ? String(prefillPrice) : '');
  const [hourlyPrice, setHourlyPrice] = useState('');
  const [dailyPrice, setDailyPrice] = useState('');

  // Simple validation: check if at least one price field, when converted to a number, is greater than 0
  const isValid =
    (parseFloat(pricePerHead) > 0 && !isNaN(parseFloat(pricePerHead))) ||
    (parseFloat(hourlyPrice) > 0 && !isNaN(parseFloat(hourlyPrice))) ||
    (parseFloat(dailyPrice) > 0 && !isNaN(parseFloat(dailyPrice)));

  const handleConfirm = async () => {
    // Validate that at least one pricing type is provided
    if (!isValid) {
      alert('Please specify at least one pricing type (Price per Head, Hourly, or Per Day).');
      return;
    }

    // Convert to numbers, use 0 if empty
    const price_per_head_val = pricePerHead ? parseInt(pricePerHead, 10) : 0;
    const hourly_price_val = hourlyPrice ? parseInt(hourlyPrice, 10) : 0;
    const daily_price_val = dailyPrice ? parseInt(dailyPrice, 10) : 0;

    navigation.navigate('VenueHost', {
      email,
      accessToken,
      name,
      address,
      city,
      phone,
      capacity_max,
      price_per_head: price_per_head_val,
      hourly_price: hourly_price_val,
      daily_price: daily_price_val,
      category,
      logo_url,
      bio,
      interests,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pricing</Text>
        <View style={styles.placeholder} />
      </View>
      
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.stepText}>Step 10 of 11</Text>
        <Text style={styles.subtitle}>Set your event pricing</Text>
        
        {/* Mandatory Pricing Message */}
        <View style={styles.mandatoryMessage}>
          <Text style={styles.mandatoryText}>
            ⚠️ At least one pricing type is mandatory. You can specify all three or any combination.
          </Text>
        </View>

        {/* Price Per Head Input */}
        <PricingInput
          title="Price per head"
          placeholder="0.00"
          unit={null}
          value={pricePerHead}
          onChangeText={setPricePerHead}
        />

        {/* Hourly Input */}
        <PricingInput
          title="Hourly"
          placeholder="0.00"
          unit="/hour"
          value={hourlyPrice}
          onChangeText={setHourlyPrice}
        />

        {/* Per Day Input */}
        <PricingInput
          title="Per Day"
          placeholder="0.00"
          unit="/day"
          value={dailyPrice}
          onChangeText={setDailyPrice}
        />
      </ScrollView>

      {/* Fixed Confirm Button Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.confirmButtonContainer, !isValid && styles.disabledButton]}
          onPress={handleConfirm}
          disabled={!isValid}
        >
          <LinearGradient
            colors={COLORS.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.confirmButton}
          >
            <Text style={styles.buttonText}>Confirm</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default EventPricingScreen;

// --- Styles ---

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
    // Add padding top for Android
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 15,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  backButton: {
    padding: 5,
  },
  placeholder: {
    width: 24, // Matches the size of the back icon for centering the title
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 30,
    flexGrow: 1,
  },
  stepText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 30,
  },
  mandatoryMessage: {
    backgroundColor: COLORS.inputBackground,
    borderColor: COLORS.primary + "40",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 25,
  },
  mandatoryText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '500',
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 25,
  },
  inputLabel: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '500',
    marginBottom: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 55,
    paddingHorizontal: 15,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    backgroundColor: "#fff",
  },
  currencySymbol: {
    fontSize: 18,
    color: COLORS.textSecondary,
    marginRight: 8,
    fontWeight: 'bold',
  },
  textInput: {
    flex: 1,
    fontSize: 18,
    color: COLORS.textPrimary,
    // Ensure padding is correct across platforms
    paddingVertical: Platform.OS === 'ios' ? 15 : 10, 
  },
  unitText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginLeft: 8,
  },
  footer: {
    padding: 20,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  confirmButtonContainer: {
    borderRadius: BORDER_RADIUS.pill,
    ...SHADOWS.primaryGlow,
  },
  confirmButton: {
    paddingVertical: 15,
    borderRadius: BORDER_RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6,
    shadowOpacity: 0,
  },
  buttonText: {
    color: COLORS.textInverted,
    fontSize: 18,
    fontWeight: '700',
  },
});
