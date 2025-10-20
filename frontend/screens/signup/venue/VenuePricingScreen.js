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

// --- Design Constants ---
const PRIMARY_COLOR = '#5f27cd'; // Deep purple for the button
const TEXT_COLOR = '#1e1e1e'; // Dark text color (for titles and labels)
const LIGHT_TEXT_COLOR = '#6c757d'; // Lighter grey (for helper text)
const BACKGROUND_COLOR = '#f7f7f7'; // Very light grey background
const CARD_BACKGROUND = '#ffffff'; // White background for the card/inputs

// Reusable component for the pricing input fields (allow one decimal)
const PricingInput = ({ title, placeholder, unit, value, onChangeText }) => {
  // Allow digits only - no decimal formatting
  const handleTextChange = (text) => {
    const sanitized = text.replace(/\D/g, ''); // digits only
    onChangeText(sanitized);
  };
  
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{title}</Text>
      <View style={styles.inputContainer}>
        <Text style={styles.currencySymbol}>₹</Text>
        <TextInput
          style={styles.textInput}
          onChangeText={handleTextChange}
          value={value}
          placeholder={placeholder}
          placeholderTextColor="#adb5bd"
          keyboardType="number-pad"
          // Allow empty input for better UX
          defaultValue=""
        />
        {unit && <Text style={styles.unitText}>{unit}</Text>}
      </View>
    </View>
  );
};

// Simple Text Back Arrow (Replaces the failing SVG component)
const BackArrow = ({ color }) => (
    <Text style={{ fontSize: 24, color: color, transform: [{ scaleX: Platform.OS === 'ios' ? 1.5 : 1.2 }] }}>
        {'<'} 
    </Text>
);

// Main Screen Component
const EventPricingScreen = ({ navigation, route }) => {
  const { email, name, address, city, phone, capacity_max, price_per_head: prefillPrice, category, logo_url, bio, interests } = route.params || {};
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
            // In a production app, navigation.goBack() handles the back action.
            onPress={() => navigation && navigation.goBack ? navigation.goBack() : console.log('Go Back Action')}
            style={styles.backButton}
        >
          <BackArrow color={TEXT_COLOR} />
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
          style={[styles.confirmButton, !isValid && styles.disabledButton]}
          onPress={handleConfirm}
          disabled={!isValid}
        >
          <Text style={styles.buttonText}>Confirm</Text>
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
    backgroundColor: BACKGROUND_COLOR,
    // Add padding top for Android
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 15,
    backgroundColor: CARD_BACKGROUND,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_COLOR,
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
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
    color: TEXT_COLOR,
    marginBottom: 30,
  },
  mandatoryMessage: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 25,
  },
  mandatoryText: {
    fontSize: 14,
    color: '#856404',
    fontWeight: '500',
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 25,
  },
  inputLabel: {
    fontSize: 16,
    color: TEXT_COLOR,
    fontWeight: '500',
    marginBottom: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BACKGROUND,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ced4da',
    height: 55,
    paddingHorizontal: 15,
  },
  currencySymbol: {
    fontSize: 18,
    color: LIGHT_TEXT_COLOR,
    marginRight: 8,
    fontWeight: 'bold',
  },
  textInput: {
    flex: 1,
    fontSize: 18,
    color: TEXT_COLOR,
    // Ensure padding is correct across platforms
    paddingVertical: Platform.OS === 'ios' ? 15 : 10, 
  },
  unitText: {
    fontSize: 16,
    color: LIGHT_TEXT_COLOR,
    marginLeft: 8,
  },
  footer: {
    padding: 20,
    backgroundColor: CARD_BACKGROUND,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  confirmButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PRIMARY_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  disabledButton: {
    backgroundColor: '#9c88ff',
    opacity: 0.8,
    elevation: 0,
    shadowOpacity: 0,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
