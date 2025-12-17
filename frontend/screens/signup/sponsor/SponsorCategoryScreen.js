import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  ScrollView,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ProgressBar from '../../../components/Progressbar';
import { Ionicons } from '@expo/vector-icons';

import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../../constants/theme";

// --- Constants & Styling ---
const { width } = Dimensions.get('window');

// --- Initial Data ---
const defaultCategories = [
  'Sports', 'Music', 'Technology', 'Travel', 'Food & Drink',
  'Art & Culture', 'Fitness', 'Gaming', 'Movies', 'Books',
  'Fashion', 'Photography', 'Outdoors', 'Volunteering', 'Networking',
];

const STORAGE_KEY = 'community_categories';

// --- Components ---

/**
 * Category Chip Component (Selectable Tag)
 */
const CategoryChip = ({ category, isSelected, onPress }) => (
  <TouchableOpacity
    style={[
      styles.chip,
      {
        backgroundColor: isSelected ? COLORS.primary : COLORS.background,
        borderColor: isSelected ? COLORS.primary : COLORS.border,
      }
    ]}
    onPress={() => onPress(category)}
    activeOpacity={0.7}
    accessibilityRole="button"
    accessibilityState={{ selected: isSelected }}
    accessibilityLabel={`Category: ${category}. ${isSelected ? 'Selected' : 'Tap to select'}.`}
    >
    <Text
      style={[
        styles.chipText,
        { color: isSelected ? COLORS.textInverted : COLORS.textPrimary },
      ]}
    >
      {category}
    </Text>
  </TouchableOpacity>
);

/**
 * Main Screen Component
 */
const SponsorCategoryScreen = ({ navigation, route }) => {
  const { email, accessToken, name, logo_url, bio, phone } = route.params || {};
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [availableCategories, setAvailableCategories] = useState(defaultCategories);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Load saved categories on component mount
  useEffect(() => {
    loadSavedCategories();
  }, []);

  const loadSavedCategories = async () => {
    try {
      const savedCategories = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedCategories) {
        const parsedCategories = JSON.parse(savedCategories);
        setAvailableCategories([...defaultCategories, ...parsedCategories]);
      }
    } catch (error) {
      console.error('Error loading saved categories:', error);
    }
  };

  const saveNewCategory = async (categoryName) => {
    try {
      const savedCategories = await AsyncStorage.getItem(STORAGE_KEY);
      let categories = savedCategories ? JSON.parse(savedCategories) : [];
      
      // Add new category if it doesn't exist
      if (!categories.includes(categoryName) && !defaultCategories.includes(categoryName)) {
        categories.push(categoryName);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
        setAvailableCategories(prev => [...prev, categoryName]);
      }
    } catch (error) {
      console.error('Error saving new category:', error);
    }
  };

  // Toggle selection state for a category chip
  const toggleCategory = (category) => {
    setSelectedCategories(prevSelected => {
      if (prevSelected.includes(category)) {
        return prevSelected.filter(c => c !== category);
      } else {
        return [...prevSelected, category];
      }
    });
  };

  const handleCreateNewCategory = () => {
    setShowCreateModal(true);
  };

  const handleCreateCategory = () => {
    const trimmedName = newCategoryName.trim();
    
    if (!trimmedName) {
      Alert.alert('Error', 'Please enter a category name.');
      return;
    }
    
    if (availableCategories.includes(trimmedName)) {
      Alert.alert('Error', 'This category already exists.');
      return;
    }
    
    // Save the new category
    saveNewCategory(trimmedName);
    
    // Close modal and reset input
    setShowCreateModal(false);
    setNewCategoryName('');
    
    Alert.alert('Success', 'New category created successfully!');
  };

  const handleCancelCreate = () => {
    setShowCreateModal(false);
    setNewCategoryName('');
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleNext = () => {
    if (selectedCategories.length === 0) {
      alert('Please select at least one category');
      return;
    }
    navigation.navigate("SponsorInterests", { 
      email, 
      accessToken, 
      name, 
      phone,
      logo_url, 
      bio, 
      category: selectedCategories[0] // Take first selected category
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Custom Header with Back button */}
        <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} accessibilityLabel="Go back" style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarContainer}>
            <Text style={styles.stepText}>Step 7 of 8</Text>
            <ProgressBar progress={87} />
        </View>
        
        <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
        >
            <View style={styles.contentArea}>
                <Text style={styles.mainTitle}>
                Choose Sponsor Category
                </Text>
                <Text style={styles.subtitle}>
                Select categories that best fit your brand.
                </Text>

                {/* Category Chips Container */}
                <View style={styles.chipsContainer}>
                {availableCategories.map(category => (
                    <CategoryChip
                    key={category}
                    category={category}
                    isSelected={selectedCategories.includes(category)}
                    onPress={toggleCategory}
                    />
                ))}
                </View>

                {/* Create New Category Button */}
                <TouchableOpacity
                style={styles.createNewButton}
                onPress={handleCreateNewCategory}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Create New Category"
                >
                <Text style={styles.createNewIcon}>+</Text>
                <Text style={styles.createNewText}>Create New Category</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>

        {/* Fixed Finish Button Container */}
        <View style={styles.buttonContainer}>
            <TouchableOpacity
            style={styles.finishButtonContainer}
            onPress={handleNext}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Next step"
            >
                <LinearGradient
                    colors={COLORS.primaryGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.finishButton}
                >
                    <Text style={styles.buttonText}>Next</Text>
                </LinearGradient>
            </TouchableOpacity>
        </View>
      </View>

      {/* Create New Category Modal */}
      <Modal
        visible={showCreateModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelCreate}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Category</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="Enter category name"
              placeholderTextColor={PLACEHOLDER_TEXT}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              autoFocus={true}
              maxLength={30}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={handleCancelCreate}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.createButton]}
                onPress={handleCreateCategory}
              >
                <Text style={styles.createButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  container: {
    flex: 1,
    paddingHorizontal: width * 0.05,
    backgroundColor: COLORS.background,
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
    marginBottom: 40,
  },
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 12, // Slightly increased padding
    borderRadius: 25,
    borderWidth: 2, // Consistent with design system
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  chipText: {
    fontSize: 16, // Consistent font size
    fontWeight: '600',
  },

  // --- Create New Button Styles ---
  createNewButton: {
    flexDirection: 'row',
    alignSelf: 'stretch', // Full width
    alignItems: 'center',
    justifyContent: 'center', // Center content
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    backgroundColor: COLORS.background,
  },
  createNewIcon: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.primary,
    marginRight: 8,
  },
  createNewText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
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
    height: 70, // Consistent height
    borderRadius: BORDER_RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: COLORS.textInverted,
    fontSize: 18,
    fontWeight: '700',
  },

  // --- Modal Styles ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 25,
    width: '100%',
    maxWidth: 350,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: DARK_TEXT,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: LIGHT_GRAY,
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: DARK_TEXT,
    marginBottom: 25,
    backgroundColor: '#f8f9fa',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: LIGHT_GRAY,
  },
  createButton: {
    backgroundColor: PRIMARY_COLOR,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: DARK_TEXT,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

export default SponsorCategoryScreen;
