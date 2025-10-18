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

// --- Constants & Styling ---
const { width } = Dimensions.get('window');
const PRIMARY_COLOR = '#6C63FF';    // Vibrant purple for accents
const LIGHT_GRAY = '#F0F0F0';      // Screen background color
const DARK_TEXT = '#1F1F39';       // Main text color
const PLACEHOLDER_TEXT = '#8888AA';// Placeholder text color
const BUTTON_INACTIVE_BG = '#FFFFFF'; // White background for unselected chips

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
        borderColor: isSelected ? PRIMARY_COLOR : PLACEHOLDER_TEXT + '40',
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
        { color: isSelected ? 'white' : DARK_TEXT },
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
      alert('Please select at least 3 sponsor types or choose "Open to All"');
      return;
    }
    
    const sponsor_types = isOpenToAll ? ['Open to All'] : selectedTypes;
    
    // Debug: Log the data being sent
    console.log('Community signup data:', {
      name,
      logo_url,
      bio,
      category,
      location,
      email,
      phone,
      sponsor_types,
      heads,
    });
    
    try {
      const { apiPost } = require('../../../api/client');
      await apiPost("/communities/signup", {
        name,
        logo_url,
        bio,
        category,
        location,
        email,
        phone,
        sponsor_types,
        heads,
      });
      
      navigation.navigate("CommunityHome");
    } catch (e) {
      console.error('Community signup error:', e);
      console.error('Error details:', e.response?.data || e.message);
      alert(`Failed to create community account: ${e.response?.data?.error || e.message || 'Unknown error'}`);
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
              <Text style={styles.backIcon}>&larr;</Text> 
            </TouchableOpacity>
            
            <Text style={styles.headerTitle}>Choose Sponsor Type</Text>
            
            {/* Empty space to align the title center-wise */}
            <View style={styles.headerButton} /> 
          </View>

          {/* Progress Bar (100% complete) */}
          <View style={styles.progressBarContainer}>
            <Text style={styles.stepText}>Step 7 of 7</Text>
            <ProgressBar progress={100} />
          </View>
          
          <ScrollView
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
                    backgroundColor: openToAllIsSelected ? PRIMARY_COLOR : BUTTON_INACTIVE_BG,
                    borderColor: openToAllIsSelected ? PRIMARY_COLOR : PLACEHOLDER_TEXT + '40',
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
                    { color: openToAllIsSelected ? 'white' : DARK_TEXT }
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
              style={styles.finishButton}
              onPress={handleFinish}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Finish setup"
            >
              <Text style={styles.buttonText}>Finish</Text>
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
    backgroundColor: LIGHT_GRAY,
  },
  background: {
    flex: 1,
    backgroundColor: LIGHT_GRAY,
    paddingTop: 10,
    alignItems: 'center',
  },
  card: {
    backgroundColor: 'white',
    width: width * 0.9, 
    flex: 1,
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 8,
    marginBottom: 20,
  },
  
  // --- Header Styles (Reused) ---
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
    paddingHorizontal: 5,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 28,
    fontWeight: '300',
    color: DARK_TEXT,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: DARK_TEXT,
  },

  // --- Progress Bar Styles (Reused) ---
  progressBarContainer: {
    marginBottom: 40,
  },
  stepText: {
    fontSize: 14,
    color: PLACEHOLDER_TEXT,
    marginBottom: 8,
    textAlign: 'right',
    opacity: 0.8,
  },

  // --- Content Styles (Reused) ---
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100,
  },
  contentArea: {
    alignItems: 'flex-start',
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: DARK_TEXT,
    marginBottom: 10,
    lineHeight: 30,
  },
  subtitle: {
    fontSize: 16,
    color: PLACEHOLDER_TEXT,
    marginBottom: 30,
  },

  // --- Chips/Tags Styles (Reused) ---
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 40,
  },
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  chipText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // --- Open to All Button Styles ---
  openToAllButton: {
    alignSelf: 'stretch', // Take full width
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: PLACEHOLDER_TEXT,
    justifyContent: 'center',
    alignItems: 'center',
    // Remove shadow for the Open to All button for contrast with chips
  },
  openToAllText: {
    fontSize: 16,
    fontWeight: '700',
    color: DARK_TEXT,
  },

  // --- Finish Button Styles (Reused) ---
  buttonContainer: {
    paddingVertical: 15,
    position: 'absolute',
    bottom: 0,
    left: 20, 
    right: 20, 
    backgroundColor: 'white',
  },
  finishButton: {
    width: '100%',
    height: 60,
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
});

export default CommunitySponsorTypeSelect;
