import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  ScrollView,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiPost } from '../../../api/client';

// --- Consistent Design Constants ---
const { width } = Dimensions.get('window');
const PRIMARY_COLOR = '#5f27cd';     // Consistent Deep Purple
const TEXT_COLOR = '#1e1e1e';
const LIGHT_TEXT_COLOR = '#6c757d'; // Used for step text
const BACKGROUND_COLOR = '#ffffff'; // Consistent White background
const BUTTON_INACTIVE_BG = '#FFFFFF';
const TRACK_COLOR = '#e0e0e0';      // Light gray for track/border
const PLACEHOLDER_TEXT = '#6c757d'; // Used for subtitles

// --- Custom Progress Bar Reimplementation ---
const SimpleProgressBar = ({ progress }) => {
    return (
        <View style={progressBarStyles.track}>
            <View style={[progressBarStyles.fill, { width: `${progress}%` }]} />
        </View>
    );
};

const progressBarStyles = StyleSheet.create({
    track: {
        height: 8,
        width: '100%',
        backgroundColor: TRACK_COLOR,
        borderRadius: 4,
        overflow: 'hidden',
    },
    fill: {
        height: '100%',
        backgroundColor: PRIMARY_COLOR,
        borderRadius: 4,
    }
});


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
                backgroundColor: isSelected ? PRIMARY_COLOR : BUTTON_INACTIVE_BG,
                borderColor: isSelected ? PRIMARY_COLOR : TRACK_COLOR, // Using consistent track color for inactive border
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
                // Using consistent TEXT_COLOR for inactive text
                { color: isSelected ? 'white' : TEXT_COLOR },
            ]}
        >
            {type}
        </Text>
    </TouchableOpacity>
);

/**
 * Main Screen Component
 */
const CommunitySponsorTypeSelect = ({ navigation, route }) => {
  const {
    email,
    accessToken,
    name,
    logo_url,
    bio,
    category,
    categories = [],
    location,
    phone,
    secondary_phone,
    heads,
  } = route.params || {};
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [isOpenToAll, setIsOpenToAll] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toggle selection state for a sponsor type chip
  const toggleType = (type) => {
    // If selecting a chip, automatically disable 'Open to All'
    setIsOpenToAll(false);

    setSelectedTypes((prevSelected) => {
      if (prevSelected.includes(type)) {
        return prevSelected.filter((t) => t !== type);
      }
      return [...prevSelected, type];
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
      Alert.alert(
        'Select Sponsor Types',
        'Please select at least 3 sponsor types or choose "Open to All".'
      );
      return;
    }

    if (isSubmitting) {
      return;
    }

    const sponsor_types = isOpenToAll ? ['Open to All'] : selectedTypes;
    const rawCategories = Array.isArray(categories) && categories.length > 0
      ? categories
      : (category ? [category] : []);
    const categoryList = Array.from(
      new Set(
        rawCategories
          .map((c) => (typeof c === 'string' ? c.trim() : ''))
          .filter((c) => c)
      )
    ).slice(0, 3);
    if (categoryList.length === 0) {
      Alert.alert('Missing Categories', 'Please go back and select at least one category.');
      return;
    }
    const payload = {
      name,
      logo_url,
      bio,
      category: categoryList[0],
      categories: categoryList,
      location: location ?? null,
      email,
      phone,
      secondary_phone,
      sponsor_types,
      heads,
    };

    try {
      setIsSubmitting(true);
      await apiPost('/communities/signup', payload, 15000, accessToken);

      navigation.navigate('CommunityUsername', {
        userData: payload,
        accessToken,
      });
    } catch (error) {
      console.error('Community signup error:', error);
      const message =
        error?.response?.data?.error || error?.message || 'Unknown error occurred';
      Alert.alert('Unable to create community', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openToAllIsSelected = isOpenToAll;
  const isButtonDisabled = (!isOpenToAll && selectedTypes.length < 3) || isSubmitting;


    return (
        // FIX 1: Consistent Safe Area implementation
        <SafeAreaView style={styles.safeArea}>
            
            <View style={styles.container}>
                
                {/* Header Row (Back Button) */}
                <View style={styles.headerRow}>
                    <TouchableOpacity 
                        onPress={handleBack} 
                        style={styles.backButton}
                        accessibilityLabel="Go back"
                    >
                        <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
                    </TouchableOpacity>
                </View>

                {/* Progress Bar and Step Text */}
                <View style={styles.progressContainer}>
                    <Text style={styles.stepText}>Step 8 of 9</Text>
                    {/* FIX 2: Using SimpleProgressBar with updated progress value */}
                    <SimpleProgressBar progress={89} />
                </View>

                {/* Scrollable Content */}
                <ScrollView
                    style={styles.contentScrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.contentArea}>
                        <Text style={styles.mainTitle}>
                            Choose Sponsor Type
                        </Text>
                        <Text style={styles.subtitle}>
                            Select the types of sponsors you are looking for.
                        </Text>

                        {/* Sponsor Type Chips Container */}
                        <View style={styles.chipsContainer}>
                            {initialSponsorTypes.map(type => (
                                <SponsorChip
                                    key={type}
                                    type={type}
                                    // Logic: If 'Open to All' is selected OR the individual type is in selectedTypes
                                    isSelected={isOpenToAll || selectedTypes.includes(type)}
                                    onPress={toggleType}
                                />
                            ))}
                        </View>

                        {/* Open to All Button (Styled like a main button) */}
                        <TouchableOpacity
                            style={[
                                styles.openToAllButton,
                                {
                                    backgroundColor: openToAllIsSelected ? PRIMARY_COLOR : BUTTON_INACTIVE_BG,
                                    borderColor: openToAllIsSelected ? PRIMARY_COLOR : TRACK_COLOR,
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
                                    { color: openToAllIsSelected ? 'white' : TEXT_COLOR }
                                ]}
                            >
                                Open to All
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </View>

            {/* Fixed Finish Button Container */}
            <View style={styles.buttonFixedContainer}>
                <TouchableOpacity
                    style={[
                        styles.finishButton,
                        isButtonDisabled && styles.disabledButton,
                    ]}
                    onPress={handleFinish}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Next step"
                    disabled={isButtonDisabled}
                >
                    <Text style={styles.buttonText}>
                        {isSubmitting ? 'Submitting...' : 'Next'}
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

// --- Stylesheet ---
const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: BACKGROUND_COLOR,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    container: {
        flex: 1,
        paddingHorizontal: width * 0.05, // Consistent horizontal padding
        backgroundColor: BACKGROUND_COLOR,
    },
    
    // --- Header Styles ---
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'center',
        width: '100%',
        paddingTop: 15,
        paddingBottom: 5,
    },
    backButton: {
        padding: 10,
        marginLeft: -10,
    },

    // --- Progress Bar Styles ---
    progressContainer: {
        width: '100%',
        marginBottom: 40,
        height: 20,
    },
    stepText: {
        fontSize: 14,
        color: LIGHT_TEXT_COLOR,
        marginBottom: 5,
        textAlign: 'left', // Aligned left for consistency
    },

    // --- Content Styles ---
    contentScrollView: {
        flex: 1,
        width: '100%',
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 110, // Space for the fixed button
    },
    contentArea: {
        alignItems: 'flex-start',
        width: '100%',
    },
    mainTitle: {
        fontSize: 32,
        fontWeight: '800',
        color: TEXT_COLOR,
        marginBottom: 10,
        lineHeight: 38,
    },
    subtitle: {
        fontSize: 16,
        color: PLACEHOLDER_TEXT,
        marginBottom: 30,
    },

    // --- Chips/Tags Styles ---
    chipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 30, // Reduced space before next button/chip
    },
    chip: {
        paddingHorizontal: 20,
        paddingVertical: 12, // Slightly increased padding for consistency
        borderRadius: 25,
        borderWidth: 2, // Consistent border width
    },
    chipText: {
        fontSize: 16, // Consistent font size
        fontWeight: '600',
    },

    // --- Open to All Button Styles ---
    openToAllButton: {
        alignSelf: 'stretch',
        height: 60, // Consistent height with input fields/other buttons
        paddingHorizontal: 30,
        paddingVertical: 15,
        borderRadius: 15,
        borderWidth: 2, // Consistent border width
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    openToAllText: {
        fontSize: 18,
        fontWeight: '700',
    },

    // --- Fixed Button Container ---
    buttonFixedContainer: {
        position: 'absolute',
        bottom: 0,
        width: width,
        paddingHorizontal: width * 0.05,
        paddingVertical: 15,
        backgroundColor: BACKGROUND_COLOR,
        paddingBottom: Platform.OS === 'ios' ? 40 : 25,
        zIndex: 10,
    },
    finishButton: {
        width: '100%',
        height: 70, // Consistent button height
        backgroundColor: PRIMARY_COLOR,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '700',
    },
    disabledButton: {
        opacity: 0.6,
    },
});

export default CommunitySponsorTypeSelect;