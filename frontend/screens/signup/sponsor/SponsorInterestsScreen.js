 import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  ScrollView,
} from 'react-native';
import ProgressBar from '../../../components/Progressbar';

import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../../constants/theme";
import { Ionicons } from '@expo/vector-icons';

// --- Constants & Styling ---
const { width } = Dimensions.get('window');

// --- Initial Data ---
const initialSponsorTypes = [
  'Protein brands', 'Energy Drinks', 'Supplements', 'Apparel',
  'Tech Gadgets', 'Local Businesses',
];

// --- Components ---

/**
 * Sponsor Chip Component (Selectable Tag)
 */
const SponsorChip = ({ type, isSelected, onPress }) => (
  <TouchableOpacity
    style={[
      styles.chip,
      {
        backgroundColor: isSelected ? COLORS.primary : COLORS.background,
        borderColor: isSelected ? COLORS.primary : COLORS.border,
      }
    ]}
    onPress={() => onPress(type)}
    activeOpacity={0.7}
    accessibilityRole="button"
    accessibilityState={{ selected: isSelected }}
    accessibilityLabel={`Sponsor Type: ${type}. ${isSelected ? 'Selected' : 'Tap to select'}.`}
  >
    <Text
      style={[
        styles.chipText,
        { color: isSelected ? COLORS.textInverted : COLORS.textPrimary },
      ]}
    >
      {type}
    </Text>
  </TouchableOpacity>
);

/**
 * Main Screen Component
 */
const SponsorTypeSelect = ({ navigation, route }) => {
  const { email, accessToken, name, logo_url, bio, category, location, phone, heads } = route.params || {};
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [isOpenToAll, setIsOpenToAll] = useState(false);

  // Toggle selection state for a sponsor type chip
  const toggleType = (type) => {
    // If selecting a chip, automatically disable 'Open to All'
    setIsOpenToAll(false);

    setSelectedTypes(prevSelected => {
      if (prevSelected.includes(type)) {
        return prevSelected.filter(t => t !== type);
      } else {
        return [...prevSelected, type];
      }
    });
  };

  const handleOpenToAll = () => {
    if (!isOpenToAll) {
      // When enabling "Open to All", select all sponsor types
      setSelectedTypes([...initialSponsorTypes]);
      setIsOpenToAll(true);
    } else {
      // When disabling "Open to All", clear all selections
      setSelectedTypes([]);
      setIsOpenToAll(false);
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleFinish = async () => {
    if (!isOpenToAll && selectedTypes.length < 3) {
      alert('Please select at least 3 interest types or choose "Open to All"');
      return;
    }
    
    const interests = isOpenToAll ? ['Open to All'] : selectedTypes;
    
    // Debug: Log the data being sent
    console.log('Sponsor signup data:', {
      name,
      logo_url,
      bio,
      category,
      email,
      phone,
      interests,
    });
    try {
      const { apiPost } = require('../../../api/client');
      await apiPost("/sponsors/signup", {
        name,
        logo_url,
        bio,
        category,
        email,
        phone,
        interests,
      });
      
      navigation.navigate("SponsorUsername", { userData: route.params, accessToken });
    } catch (e) {
      console.error('Sponsor signup error:', e);
      console.error('Error details:', e.response?.data || e.message);
      alert(`Failed to create sponsor account: ${e.response?.data?.error || e.message || 'Unknown error'}`);
    }
  };

  // Determine the state of the Open to All button - only highlight when explicitly selected
  const openToAllIsSelected = isOpenToAll;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.background}>
        
        {/* Main Card */}
        <View style={styles.card}>

        {/* Custom Header with Back button */}
        <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} accessibilityLabel="Go back" style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
        </View>

          {/* Progress Bar (100% complete) */}
          <View style={styles.progressBarContainer}>
            <Text style={styles.stepText}>Step 8 of 8</Text>
            <ProgressBar progress={100} />
          </View>
          
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.contentArea}>
              <Text style={styles.mainTitle}>
                Choose Your Interests
              </Text>
              <Text style={styles.subtitle}>
                Select the types of communities you are interested in sponsoring.
              </Text>

              {/* Sponsor Type Chips Container */}
              <View style={styles.chipsContainer}>
                {initialSponsorTypes.map(type => (
                  <SponsorChip
                    key={type}
                    type={type}
                    // Show all chips as selected when 'Open to All' is active
                    isSelected={isOpenToAll || selectedTypes.includes(type)}
                    onPress={toggleType}
                  />
                ))}
              </View>

              {/* Open to All Button */}
              <TouchableOpacity
                style={[
                  styles.openToAllButton,
                  {
                    backgroundColor: openToAllIsSelected ? COLORS.primary : COLORS.background,
                    borderColor: openToAllIsSelected ? COLORS.primary : COLORS.border,
                  }
                ]}
                onPress={handleOpenToAll}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Open to All Sponsors"
              >
                <Text 
                  style={[
                    styles.openToAllText,
                    { color: openToAllIsSelected ? COLORS.textInverted : COLORS.textPrimary }
                  ]}
                >
                  Open to All
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Fixed Finish Button Container */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.finishButtonContainer}
              onPress={handleFinish}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Finish setup"
            >
                <LinearGradient
                    colors={COLORS.primaryGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.finishButton}
                >
                    <Text style={styles.buttonText}>Finish</Text>
                </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

// --- Stylesheet ---
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  background: {
    flex: 1,
    paddingHorizontal: width * 0.05,
    backgroundColor: COLORS.background,
  },
  card: {
    flex: 1,
  },
  
  // --- Header Styles ---
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 15,
    paddingBottom: 5,
  },
  headerButton: {
    padding: 10,
    marginLeft: -10,
  },

  // --- Progress Bar Styles ---
  progressBarContainer: {
    marginBottom: 40,
  },
  stepText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 5,
  },

  // --- Content Styles ---
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 110,
  },
  contentArea: {
    alignItems: 'flex-start',
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 10,
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 30,
  },

  // --- Chips/Tags Styles ---
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 30,
  },
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  chipText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // --- Open to All Button Styles ---
  openToAllButton: {
    alignSelf: 'stretch',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  openToAllText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  // --- Finish Button Styles ---
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    width: width,
    paddingHorizontal: width * 0.05,
    paddingVertical: 15,
    backgroundColor: COLORS.background,
    paddingBottom: Platform.OS === 'ios' ? 40 : 25,
    zIndex: 10,
  },
  finishButtonContainer: {
    width: '100%',
    borderRadius: BORDER_RADIUS.pill,
    ...SHADOWS.primaryGlow,
  },
  finishButton: {
    width: '100%',
    height: 70,
    borderRadius: BORDER_RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: COLORS.textInverted,
    fontSize: 18,
    fontWeight: '700',
  },
});

export default SponsorTypeSelect;
