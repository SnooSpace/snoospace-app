import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';

// Local constants removed in favor of theme constants

export default function SearchResultsList({ 
  results, 
  onSelect, 
  visible 
}) {
  if (!visible || !results || results.length === 0) {
    return null;
  }

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => onSelect(item)}
    >
      <Ionicons 
        name="location-outline" 
        size={20} 
        color={COLORS.textSecondary} 
        style={styles.icon}
      />
      <View style={styles.textContainer}>
        <Text style={styles.addressText} numberOfLines={1}>
          {item.address}
        </Text>
        {(item.city || item.state) && (
          <Text style={styles.locationText} numberOfLines={1}>
            {[item.city, item.state].filter(Boolean).join(', ')}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={results}
        renderItem={renderItem}
        keyExtractor={(item, index) => `result-${index}`}
        style={styles.list}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background || '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border || '#e9ecef',
    maxHeight: 200,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  list: {
    maxHeight: 200,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border || '#e9ecef',
  },
  icon: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  addressText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  locationText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});

