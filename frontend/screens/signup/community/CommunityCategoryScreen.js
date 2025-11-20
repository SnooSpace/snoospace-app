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
  Platform,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ProgressBar from '../../../components/Progressbar';
import { Ionicons } from '@expo/vector-icons'; // Import Ionicons for the back arrow

// --- Consistent Design Constants ---
const PRIMARY_COLOR = "#5f27cd";       // Deep purple
const TEXT_COLOR = "#1e1e1e";         // Dark text
const LIGHT_TEXT_COLOR = "#6c757d";   // Lighter grey for step text
const BACKGROUND_COLOR = "#ffffff";   // White background
const INPUT_BG_COLOR = "#f8f9fa"; 
const INPUT_BORDER_COLOR = "#ced4da"; // Light border color    // Light background for input/modal buttons
const BUTTON_INACTIVE_BORDER = "#ced4da"; // Light border color

// --- Initial Data ---
const defaultCategories = [
  'Sports', 'Music', 'Technology', 'Travel', 'Food & Drink',
  'Art & Culture', 'Fitness', 'Gaming', 'Movies', 'Books',
  'Fashion', 'Photography', 'Outdoors', 'Volunteering', 'Networking',
];

const STORAGE_KEY = 'community_categories';
const MAX_CATEGORIES = 3;

// --- Components ---

/**
 * Category Chip Component (Selectable Tag)
 */
const CategoryChip = ({ category, isSelected, onPress }) => (
  <TouchableOpacity
    style={[
      styles.chip,
      {
        backgroundColor: isSelected ? PRIMARY_COLOR : BACKGROUND_COLOR,
        borderColor: isSelected ? PRIMARY_COLOR : BUTTON_INACTIVE_BORDER,
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
        { color: isSelected ? 'white' : TEXT_COLOR },
      ]}
    >
      {category}
    </Text>
  </TouchableOpacity>
);

/**
 * Main Screen Component
 */
const CommunityCategoryScreen = ({ navigation, route }) => {
  const { email, accessToken, name, logo_url, bio } = route.params || {};
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
        // Ensure unique list by filtering out defaults that might be in savedCategories
        const uniqueSaved = parsedCategories.filter(c => !defaultCategories.includes(c));
        setAvailableCategories([...defaultCategories, ...uniqueSaved]);
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
      }
      if (prevSelected.length >= MAX_CATEGORIES) {
        Alert.alert('Limit Reached', `You can select up to ${MAX_CATEGORIES} categories.`);
        return prevSelected;
      }
      return [...prevSelected, category]; 
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
    
    // Check if category already exists (case-insensitive check)
    if (availableCategories.map(c => c.toLowerCase()).includes(trimmedName.toLowerCase())) {
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
      Alert.alert('Selection Required', 'Please select at least one category before proceeding.');
      return;
    }
    navigation.navigate("CommunityLocationQuestion", { 
      email, 
      accessToken, 
      name, 
      logo_url, 
      bio, 
      category: selectedCategories[0],
      categories: selectedCategories,
    });
  };

  // Button is enabled if at least one category is selected
  const isButtonDisabled = selectedCategories.length === 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        
        {/* Header Row (Back Button) */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
          </TouchableOpacity>
        </View>

        {/* Progress Bar and Step Text */}
        <View style={styles.progressContainer}>
          <Text style={styles.stepText}>Step 4 of 9</Text>
          <ProgressBar progress={44} />
        </View>
        
        {/* Content Section */}
        <View style={styles.contentContainer}>
          <Text style={styles.title}>
            Choose Community Category
          </Text>
          <Text style={styles.subtitle}>
            Select up to 3 categories that best fit your community.
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
          >
            <Ionicons name="add-circle-outline" size={24} color={PRIMARY_COLOR} style={styles.createNewIcon} />
            <Text style={styles.createNewText}>Create New Category</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Fixed Footer/Button Section */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButton, isButtonDisabled && styles.disabledButton]}
          onPress={handleNext}
          activeOpacity={0.8}
          disabled={isButtonDisabled}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Next</Text>
        </TouchableOpacity>
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
              placeholderTextColor={LIGHT_TEXT_COLOR}
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
    backgroundColor: BACKGROUND_COLOR,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  
  // --- Header Styles (Consistent) ---
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 15,
    paddingBottom: 10,
    paddingHorizontal: 5,
  },
  backButton: {
    padding: 10,
    marginLeft: -10,
  },

  // --- Progress Bar Styles (Consistent) ---
  progressContainer: {
    marginBottom: 40,
    paddingHorizontal: 5,
  },
  stepText: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 5,
  },

  // --- Content Styles ---
  contentContainer: {
    marginTop: 10,
    paddingHorizontal: 5,
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: TEXT_COLOR,
    marginBottom: 10, // Increased spacing
  },
  subtitle: {
    fontSize: 16,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 30,
  },

  // --- Chips/Tags Styles ---
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12, // Consistent spacing between chips
    marginBottom: 40,
  },
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    borderWidth: 1,
    // Removed unnecessary shadows for a flat, clean look
  },
  chipText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // --- Create New Button Styles ---
  createNewButton: {
    flexDirection: 'row',
    alignSelf: 'center', 
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 12, // More rounded rectangle vs 25 radius circle
    borderWidth: 2,
    borderColor: PRIMARY_COLOR,
    borderStyle: 'dashed',
    backgroundColor: BACKGROUND_COLOR, 
  },
  createNewIcon: {
    marginRight: 8,
  },
  createNewText: {
    fontSize: 16,
    fontWeight: '600',
    color: PRIMARY_COLOR,
  },

  // --- Footer/Button Styles (Consistent) ---
  footer: {
    backgroundColor: BACKGROUND_COLOR,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 25, 
    borderTopWidth: 0,
  },
  nextButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    height: 60,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },

  // --- Modal Styles (Consistent) ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: BACKGROUND_COLOR,
    borderRadius: 15,
    padding: 25,
    width: '100%',
    maxWidth: 350,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_COLOR,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: INPUT_BORDER_COLOR,
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: TEXT_COLOR,
    marginBottom: 25,
    backgroundColor: INPUT_BG_COLOR,
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
    backgroundColor: INPUT_BG_COLOR, // Light background
  },
  createButton: {
    backgroundColor: PRIMARY_COLOR,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_COLOR,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

export default CommunityCategoryScreen;