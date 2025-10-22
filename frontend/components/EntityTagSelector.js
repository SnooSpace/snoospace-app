import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiGet } from "../api/client";

const COLORS = {
  primary: "#5E17EB",
  textDark: "#282C35",
  textLight: "#808080",
  background: "#FFFFFF",
  white: "#fff",
  border: "#E5E5E5",
};

const EntityTagSelector = ({ 
  onEntitiesChange, 
  initialEntities = [],
  style 
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedEntities, setSelectedEntities] = useState(initialEntities);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (onEntitiesChange) {
      onEntitiesChange(selectedEntities);
    }
  }, [selectedEntities]);

  const searchEntities = async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    try {
      // Search across all entity types
      const [membersRes, communitiesRes, sponsorsRes, venuesRes] = await Promise.all([
        apiGet(`/members/search?q=${encodeURIComponent(query)}`).catch(() => ({ members: [] })),
        apiGet(`/communities/search?q=${encodeURIComponent(query)}`).catch(() => ({ communities: [] })),
        apiGet(`/sponsors/search?q=${encodeURIComponent(query)}`).catch(() => ({ sponsors: [] })),
        apiGet(`/venues/search?q=${encodeURIComponent(query)}`).catch(() => ({ venues: [] })),
      ]);

      const results = [
        ...(membersRes.members || []).map(member => ({ ...member, type: 'member' })),
        ...(communitiesRes.communities || []).map(community => ({ ...community, type: 'community' })),
        ...(sponsorsRes.sponsors || []).map(sponsor => ({ ...sponsor, type: 'sponsor' })),
        ...(venuesRes.venues || []).map(venue => ({ ...venue, type: 'venue' })),
      ];

      setSearchResults(results);
      setShowResults(true);
    } catch (error) {
      console.error("Error searching entities:", error);
      Alert.alert("Error", "Failed to search entities");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchChange = (text) => {
    setSearchQuery(text);
    searchEntities(text);
  };

  const selectEntity = (entity) => {
    const isAlreadySelected = selectedEntities.some(
      selected => selected.id === entity.id && selected.type === entity.type
    );

    if (!isAlreadySelected) {
      const newSelected = [...selectedEntities, entity];
      setSelectedEntities(newSelected);
    }

    setSearchQuery("");
    setShowResults(false);
  };

  const removeEntity = (entityToRemove) => {
    const updated = selectedEntities.filter(
      entity => !(entity.id === entityToRemove.id && entity.type === entityToRemove.type)
    );
    setSelectedEntities(updated);
  };

  const getEntityDisplayName = (entity) => {
    switch (entity.type) {
      case 'member':
        return entity.name;
      case 'community':
        return entity.name;
      case 'sponsor':
        return entity.brand_name;
      case 'venue':
        return entity.name;
      default:
        return entity.name || entity.brand_name;
    }
  };

  const getEntityUsername = (entity) => {
    return entity.username || `@${entity.name || entity.brand_name}`;
  };

  const renderSelectedEntities = () => {
    if (selectedEntities.length === 0) return null;

    return (
      <View style={styles.selectedContainer}>
        <Text style={styles.selectedLabel}>Tagged:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {selectedEntities.map((entity, index) => (
            <TouchableOpacity
              key={`${entity.id}-${entity.type}`}
              style={styles.selectedTag}
              onPress={() => removeEntity(entity)}
            >
              <Text style={styles.selectedTagText}>
                {getEntityDisplayName(entity)}
              </Text>
              <Ionicons name="close" size={16} color={COLORS.white} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderSearchResults = () => {
    if (!showResults || searchResults.length === 0) return null;

    return (
      <View style={styles.resultsContainer}>
        <ScrollView style={styles.resultsList}>
          {searchResults.map((entity, index) => {
            const isSelected = selectedEntities.some(
              selected => selected.id === entity.id && selected.type === entity.type
            );

            return (
              <TouchableOpacity
                key={`${entity.id}-${entity.type}`}
                style={[
                  styles.resultItem,
                  isSelected && styles.resultItemSelected
                ]}
                onPress={() => selectEntity(entity)}
                disabled={isSelected}
              >
                <Text style={styles.resultName}>
                  {getEntityDisplayName(entity)}
                </Text>
                <Text style={styles.resultUsername}>
                  {getEntityUsername(entity)} • {entity.type}
                </Text>
                {isSelected && (
                  <Ionicons name="checkmark" size={20} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>Tag People & Places</Text>
      
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={COLORS.textLight} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search members, communities, sponsors, venues..."
          placeholderTextColor={COLORS.textLight}
          value={searchQuery}
          onChangeText={handleSearchChange}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {isSearching && (
          <ActivityIndicator size="small" color={COLORS.primary} />
        )}
      </View>

      {renderSelectedEntities()}
      {renderSearchResults()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textDark,
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: COLORS.background,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textDark,
    marginLeft: 8,
  },
  selectedContainer: {
    marginTop: 12,
  },
  selectedLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textDark,
    marginBottom: 8,
  },
  selectedTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  selectedTagText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "500",
    marginRight: 6,
  },
  resultsContainer: {
    position: "absolute",
    top: 100,
    left: 0,
    right: 0,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    maxHeight: 200,
    zIndex: 1000,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  resultsList: {
    maxHeight: 200,
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  resultItemSelected: {
    backgroundColor: "#F0F0FF",
  },
  resultName: {
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.textDark,
    flex: 1,
  },
  resultUsername: {
    fontSize: 14,
    color: COLORS.textLight,
    marginRight: 8,
  },
});

export default EntityTagSelector;
