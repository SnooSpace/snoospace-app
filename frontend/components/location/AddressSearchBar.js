import React, { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { searchAddress } from '../../utils/geocoding';
import SearchResultsList from './SearchResultsList';
import SnooLoader from "../ui/SnooLoader";

const TEXT_COLOR = '#1e1e1e';
const LIGHT_TEXT_COLOR = '#6c757d';
const BACKGROUND_COLOR = '#f8f9fa';
const BORDER_COLOR = '#ced4da';

export default function AddressSearchBar({ 
  onSelectLocation,
  placeholder = "Search for business address..."
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    // Debounce search
    if (searchQuery.length < 3) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchAddress(searchQuery);
        setSearchResults(results);
        setShowResults(results.length > 0);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
        setShowResults(false);
      } finally {
        setIsSearching(false);
      }
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleSelectResult = (result) => {
    setSearchQuery(result.address);
    setShowResults(false);
    setSearchResults([]);
    onSelectLocation({
      address: result.address,
      city: result.city,
      state: result.state,
      country: result.country,
      lat: result.latitude,
      lng: result.longitude,
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputWrapper}>
        <Ionicons
          name="search-outline"
          size={20}
          color={LIGHT_TEXT_COLOR}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={LIGHT_TEXT_COLOR}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="words"
          autoCorrect={false}
        />
        {isSearching && (
          <SnooLoader 
            size="small" 
            color={LIGHT_TEXT_COLOR} 
            style={styles.loader}
          />
        )}
        {searchQuery.length > 0 && !isSearching && (
          <TouchableOpacity
            onPress={() => {
              setSearchQuery('');
              setSearchResults([]);
              setShowResults(false);
            }}
            style={styles.clearButton}
          >
            <Ionicons name="close-circle" size={20} color={LIGHT_TEXT_COLOR} />
          </TouchableOpacity>
        )}
      </View>
      <SearchResultsList
        results={searchResults}
        onSelect={handleSelectResult}
        visible={showResults}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    zIndex: 10,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    backgroundColor: BACKGROUND_COLOR,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    paddingHorizontal: 15,
  },
  searchIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: TEXT_COLOR,
    paddingVertical: 0,
  },
  loader: {
    marginLeft: 8,
  },
  clearButton: {
    marginLeft: 8,
    padding: 2,
  },
});

