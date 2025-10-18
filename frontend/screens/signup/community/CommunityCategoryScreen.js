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

// --- Constants & Styling ---
const { width } = Dimensions.get('window');
const PRIMARY_COLOR = '#6C63FF';    // Vibrant purple for accents
const LIGHT_GRAY = '#F0F0F0';      // Screen background color
const DARK_TEXT = '#1F1F39';       // Main text color
const PLACEHOLDER_TEXT = '#8888AA';// Placeholder text color
const BUTTON_INACTIVE_BG = '#FFFFFF'; // White background for unselected chips

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
        backgroundColor: isSelected ? PRIMARY_COLOR : BUTTON_INACTIVE_BG,
        borderColor: isSelected ? PRIMARY_COLOR : PLACEHOLDER_TEXT + '40', // Lighter border when unselected
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
        { color: isSelected ? 'white' : DARK_TEXT },
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
    navigation.navigate("CommunityLocation", { 
      email, 
      accessToken, 
      name, 
      logo_url, 
      bio, 
      category: selectedCategories[0] // Take first selected category
    });
  };

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
            
            <Text style={styles.headerTitle}>Choose Community Category</Text>
            
            {/* Empty space to align the title center-wise, matching the Skip text on the previous screen */}
            <View style={styles.headerButton} /> 
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBarContainer}>
            <Text style={styles.stepText}>Step 4 of 7</Text>
            <ProgressBar progress={57} />
          </View>
          
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.contentArea}>
              <Text style={styles.mainTitle}>
                Choose Community Category
              </Text>
              <Text style={styles.subtitle}>
                Select categories that best fit your community.
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
                {/* Plus Icon placeholder */}
                <Text style={styles.createNewIcon}>+</Text>
                <Text style={styles.createNewText}>Create New Category</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Fixed Finish Button Container */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.finishButton}
              onPress={handleNext}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Next step"
            >
              <Text style={styles.buttonText}>Next</Text>
            </TouchableOpacity>
          </View>
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
  
  // --- Header Styles ---
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

  // --- Progress Bar Styles ---
  progressBarContainer: {
    marginBottom: 40,
  },
  stepText: {
    fontSize: 14,
    color: PLACEHOLDER_TEXT,
    marginBottom: 8,
    textAlign: 'right', // Aligned right for a clean look
    opacity: 0.8,
  },

  // --- Content Styles ---
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100, // Space for the fixed button
  },
  contentArea: {
    alignItems: 'flex-start', // Align text to the left
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

  // --- Chips/Tags Styles ---
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12, // Space between chips
    marginBottom: 40,
  },
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    borderWidth: 1,
    // Shadow for unselected state to match the overall design
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

  // --- Create New Button Styles ---
  createNewButton: {
    flexDirection: 'row',
    alignSelf: 'center', // Center the button horizontally
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: PRIMARY_COLOR,
    borderStyle: 'dashed',
    backgroundColor: LIGHT_GRAY + '80', // Slightly lighter background
  },
  createNewIcon: {
    fontSize: 22,
    fontWeight: '700',
    color: PRIMARY_COLOR,
    marginRight: 8,
  },
  createNewText: {
    fontSize: 16,
    fontWeight: '600',
    color: PRIMARY_COLOR,
  },

  // --- Finish Button Styles ---
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

export default CommunityCategoryScreen;
