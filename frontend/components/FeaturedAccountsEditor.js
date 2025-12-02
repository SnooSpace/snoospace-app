import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { uploadPerformerPhoto } from '../../api/upload';
import { searchAccounts as searchAccountsAPI } from '../../api/search';

const PRIMARY_COLOR = '#6B46C1';
const TEXT_COLOR = '#1C1C1E';
const LIGHT_TEXT_COLOR = '#8E8E93';

/**
 * FeaturedAccountsEditor - Add performers, DJs, sponsors, vendors
 * Supports: account search/linking OR manual entry
 */
const FeaturedAccountsEditor = ({ accounts = [], onChange }) => {
  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState(null); // 'search' or 'manual'
  const [role, setRole] = useState('performer');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  
  // Manual entry state
  const [manualName, setManualName] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualPhoto, setManualPhoto] = useState(null);

  const roles = [
    { value: 'performer', label: 'Performer', icon: 'mic-outline' },
    { value: 'dj', label: 'DJ', icon: 'musical-notes-outline' },
    { value: 'sponsor', label: 'Sponsor', icon: 'briefcase-outline' },
    { value: 'vendor', label: 'Vendor', icon: 'storefront-outline' },
    { value: 'speaker', label: 'Speaker', icon: 'chatbubbles-outline' },
  ];

  const startAdd = () => {
    setShowModal(true);
    setMode(null);
    setRole('performer');
    setSearchQuery('');
    setSearchResults([]);
    setManualName('');
    setManualDescription('');
    setManualPhoto(null);
  };

  const handleSearchAccounts = async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await searchAccountsAPI(query);
      
      if (response?.results) {
        setSearchResults(response.results);
      }
    } catch (error) {
      console.error('Error searching accounts:', error);
      Alert.alert('Error', 'Failed to search accounts');
    } finally {
      setSearching(false);
    }
  };

  const linkAccount = (account) => {
    const newAccount = {
      linked_account_id: account.id,
      linked_account_type: account.type,
      role,
      display_name: null,
      description: null,
      profile_photo_url: null,
      order: accounts.length,
      // Store account data for display
      _accountData: {
        name: account.display_name || account.name,
        username: account.username,
        photo: account.profile_photo_url || account.logo_url,
      },
    };

    onChange([...accounts, newAccount]);
    setShowModal(false);
  };

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setManualPhoto(result.assets[0].uri);
    }
  };

  const addManual = async () => {
    if (!manualName.trim()) {
      Alert.alert('Required', 'Please enter a name');
      return;
    }

    // Upload photo if provided
    let photoUrl = null;
    let cloudinaryId = null;

    if (manualPhoto) {
      try {
        const uploadResult = await uploadPerformerPhoto(manualPhoto);
        photoUrl = uploadResult?.url;
        cloudinaryId = uploadResult?.public_id;
      } catch (error) {
        Alert.alert('Warning', 'Failed to upload photo, continuing without it');
      }
    }

    const newAccount = {
      linked_account_id: null,
      linked_account_type: null,
      role,
      display_name: manualName.trim(),
      description: manualDescription.trim() || null,
      profile_photo_url: photoUrl,
      cloudinary_public_id: cloudinaryId,
      order: accounts.length,
    };

    onChange([...accounts, newAccount]);
    setShowModal(false);
  };

  const removeAccount = (index) => {
    Alert.alert(
      'Remove',
      'Remove this featured account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const updated = accounts.filter((_, i) => i !== index);
            const reordered = updated.map((a, i) => ({ ...a, order: i }));
            onChange(reordered);
          },
        },
      ]
    );
  };

  const renderAccount = ({ item, index }) => {
    const accountName = item._accountData?.name || item.display_name;
    const accountPhoto = item._accountData?.photo || item.profile_photo_url;
    const isLinked = !!item.linked_account_id;

    return (
      <View style={styles.accountCard}>
        <View style={styles.accountInfo}>
          {accountPhoto && (
            <Image source={{ uri: accountPhoto }} style={styles.accountPhoto} />
          )}
          {!accountPhoto && (
            <View style={[styles.accountPhoto, styles.photoPlaceholder]}>
              <Ionicons name="person-outline" size={24} color={LIGHT_TEXT_COLOR} />
            </View>
          )}
          
          <View style={styles.accountDetails}>
            <Text style={styles.accountName}>{accountName}</Text>
            <Text style={styles.accountRole}>
              {roles.find(r => r.value === item.role)?.label}
              {isLinked && ' • Linked Account'}
            </Text>
          </View>
        </View>

        <TouchableOpacity onPress={() => removeAccount(index)}>
          <Ionicons name="close-circle" size={24} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Featured Accounts (Optional)</Text>
        <Text style={styles.subtitle}>
          {accounts.length} accounts • Performers, DJs, Sponsors, Vendors
        </Text>
      </View>

      {accounts.length > 0 && (
        <FlatList
          data={accounts}
          renderItem={renderAccount}
          keyExtractor={(item, index) => index.toString()}
          scrollEnabled={false}
          style={{ marginBottom: 15 }}
        />
      )}

      <TouchableOpacity style={styles.addButton} onPress={startAdd}>
        <Ionicons name="add-circle-outline" size={24} color={PRIMARY_COLOR} />
        <Text style={styles.addButtonText}>Add Featured Account</Text>
      </TouchableOpacity>

      {/* Add Account Modal */}
      <Modal visible={showModal} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Featured Account</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={28} color={TEXT_COLOR} />
            </TouchableOpacity>
          </View>

          {/* Role Selection */}
          <View style={styles.section}>
            <Text style={styles.label}>Role *</Text>
            <View style={styles.rolesGrid}>
              {roles.map((r) => (
                <TouchableOpacity
                  key={r.value}
                  style={[styles.roleButton, role === r.value && styles.roleButtonSelected]}
                  onPress={() => setRole(r.value)}
                >
                  <Ionicons
                    name={r.icon}
                    size={20}
                    color={role === r.value ? '#FFFFFF' : PRIMARY_COLOR}
                  />
                  <Text
                    style={[styles.roleText, role === r.value && styles.roleTextSelected]}
                  >
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Mode Selection */}
          {!mode && (
            <View style={styles.section}>
              <Text style={styles.label}>Add Method</Text>
              <TouchableOpacity
                style={styles.modeButton}
                onPress={() => setMode('search')}
              >
                <Ionicons name="search-outline" size={24} color={PRIMARY_COLOR} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.modeTitle}>Link Existing Account</Text>
                  <Text style={styles.modeSubtitle}>Search for DJs, sponsors, venues</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={LIGHT_TEXT_COLOR} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modeButton}
                onPress={() => setMode('manual')}
              >
                <Ionicons name="create-outline" size={24} color={PRIMARY_COLOR} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.modeTitle}>Manual Entry</Text>
                  <Text style={styles.modeSubtitle}>For performers without accounts</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={LIGHT_TEXT_COLOR} />
              </TouchableOpacity>
            </View>
          )}

          {/* Search Mode */}
          {mode === 'search' && (
            <View style={styles.section}>
              <TouchableOpacity onPress={() => setMode(null)} style={styles.backButton}>
                <Ionicons name="arrow-back" size={20} color={PRIMARY_COLOR} />
                <Text style={styles.backText}>Back</Text>
              </TouchableOpacity>

              <Text style={styles.label}>Search Accounts</Text>
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  handleSearchAccounts(text);
                }}
                placeholder="Search by name or username..."
                placeholderTextColor={LIGHT_TEXT_COLOR}
              />

              {searching && <ActivityIndicator style={{ marginTop: 20 }} color={PRIMARY_COLOR} />}

              {searchResults.map((result) => (
                <TouchableOpacity
                  key={`${result.type}-${result.id}`}
                  style={styles.searchResult}
                  onPress={() => linkAccount(result)}
                >
                  <Image
                    source={{ uri: result.profile_photo_url || result.logo_url }}
                    style={styles.resultPhoto}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultName}>
                      {result.display_name || result.name}
                    </Text>
                    <Text style={styles.resultUsername}>@{result.username}</Text>
                  </View>
                  <Text style={styles.resultType}>{result.type}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Manual Mode */}
          {mode === 'manual' && (
            <View style={styles.section}>
              <TouchableOpacity onPress={() => setMode(null)} style={styles.backButton}>
                <Ionicons name="arrow-back" size={20} color={PRIMARY_COLOR} />
                <Text style={styles.backText}>Back</Text>
              </TouchableOpacity>

              <Text style={styles.label}>Photo (Optional)</Text>
              <TouchableOpacity style={styles.photoUpload} onPress={pickPhoto}>
                {manualPhoto ? (
                  <Image source={{ uri: manualPhoto }} style={styles.uploadedPhoto} />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={32} color={LIGHT_TEXT_COLOR} />
                    <Text style={styles.uploadText}>Tap to upload photo</Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={styles.input}
                value={manualName}
                onChangeText={setManualName}
                placeholder="Full name..."
                placeholderTextColor={LIGHT_TEXT_COLOR}
              />

              <Text style={styles.label}>Bio/Description (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={manualDescription}
                onChangeText={setManualDescription}
                placeholder="Brief bio or description..."
                placeholderTextColor={LIGHT_TEXT_COLOR}
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity style={styles.saveButton} onPress={addManual}>
                <Text style={styles.saveButtonText}>Add Account</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 15,
  },
  header: {
    marginBottom: 15,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_COLOR,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F5FF',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5DBFF',
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  accountPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  photoPlaceholder: {
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountDetails: {
    flex: 1,
  },
  accountName: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_COLOR,
  },
  accountRole: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginTop: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: PRIMARY_COLOR,
    borderRadius: 12,
    backgroundColor: '#F8F5FF',
  },
  addButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: PRIMARY_COLOR,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_COLOR,
  },
  section: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_COLOR,
    marginBottom: 10,
  },
  rolesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  roleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: PRIMARY_COLOR,
    backgroundColor: '#FFFFFF',
  },
  roleButtonSelected: {
    backgroundColor: PRIMARY_COLOR,
  },
  roleText: {
    marginLeft: 6,
    fontSize: 14,
    color: PRIMARY_COLOR,
    fontWeight: '600',
  },
  roleTextSelected: {
    color: '#FFFFFF',
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    marginBottom: 10,
  },
  modeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_COLOR,
    marginLeft: 12,
  },
  modeSubtitle: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginLeft: 12,
    marginTop: 2,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  backText: {
    marginLeft: 6,
    fontSize: 14,
    color: PRIMARY_COLOR,
    fontWeight: '600',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: TEXT_COLOR,
    backgroundColor: '#FFFFFF',
  },
  searchResult: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    marginTop: 10,
  },
  resultPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  resultName: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_COLOR,
  },
  resultUsername: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginTop: 2,
  },
  resultType: {
    fontSize: 11,
    color: PRIMARY_COLOR,
    textTransform: 'capitalize',
    backgroundColor: '#F8F5FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  photoUpload: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F5F5F5',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: LIGHT_TEXT_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  uploadedPhoto: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  uploadText: {
    marginTop: 6,
    fontSize: 11,
    color: LIGHT_TEXT_COLOR,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: TEXT_COLOR,
    backgroundColor: '#FFFFFF',
    marginBottom: 15,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: PRIMARY_COLOR,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: {
color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default FeaturedAccountsEditor;
