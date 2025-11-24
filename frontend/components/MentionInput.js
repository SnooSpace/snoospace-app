import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiGet } from '../api/client';
import { getAuthToken } from '../api/auth';
import { globalSearch } from '../api/search';

const COLORS = {
  primary: '#5f27cd',
  textDark: '#1e1e1e',
  textLight: '#6c757d',
  background: '#FFFFFF',
  border: '#E5E5EA',
};

const MentionInput = ({
  value = '',
  onChangeText,
  placeholder = 'Write a caption...',
  placeholderTextColor = COLORS.textLight,
  style,
  maxLength = 2000,
  onTaggedEntitiesChange,
}) => {
  const [text, setText] = useState(value);
  const [taggedEntities, setTaggedEntities] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (onChangeText) {
      onChangeText(text);
    }
  }, [text, onChangeText]);

  useEffect(() => {
    if (onTaggedEntitiesChange) {
      onTaggedEntitiesChange(taggedEntities);
    }
  }, [taggedEntities, onTaggedEntitiesChange]);

  const searchMembers = async (query) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      setIsSearching(true);
      const token = await getAuthToken();
      if (!token) {
        setSearchResults([]);
        return;
      }
      // Use global search but filter to only members (mentions are typically for members)
      const res = await globalSearch(trimmed, { limit: 20, offset: 0 });
      const allResults = res?.results || [];
      // Filter to only members for mentions
      const memberResults = allResults.filter(r => r.type === 'member');
      // Filter out null/undefined and ensure each item has required properties
      const validResults = memberResults
        .filter(m => m != null && typeof m === 'object' && m.id)
        .map(m => ({ 
          ...m, 
          type: 'member',
          profile_photo_url: m.profile_photo_url || null,
          full_name: m.full_name || m.name || '',
          name: m.name || m.full_name || '',
          username: m.username || ''
        }));
      setSearchResults(validResults);
    } catch (error) {
      console.error('Error searching members:', error);
      // Don't show error to user, just silently fail
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleTextChange = (newText) => {
    setText(newText);
    
    // Find @ mentions in the text
    const atIndex = newText.lastIndexOf('@', cursorPosition);
    if (atIndex !== -1) {
      const afterAt = newText.substring(atIndex + 1);
      const spaceIndex = afterAt.indexOf(' ');
      const newlineIndex = afterAt.indexOf('\n');
      const endIndex = spaceIndex !== -1 && newlineIndex !== -1
        ? Math.min(spaceIndex, newlineIndex)
        : spaceIndex !== -1
        ? spaceIndex
        : newlineIndex !== -1
        ? newlineIndex
        : afterAt.length;
      
      const mentionQuery = afterAt.substring(0, endIndex);
      if (mentionQuery.length >= 1) {
        setSearchQuery(mentionQuery);
        setShowSearch(true);
        if (mentionQuery.length >= 2) {
          searchMembers(mentionQuery);
        } else {
          setSearchResults([]);
        }
      } else {
        setShowSearch(false);
        setSearchQuery('');
      }
    } else {
      setShowSearch(false);
      setSearchQuery('');
    }
  };

  const handleSelectionChange = (event) => {
    setCursorPosition(event.nativeEvent.selection.start);
  };

  const selectEntity = (entity) => {
    const atIndex = text.lastIndexOf('@', cursorPosition);
    if (atIndex !== -1) {
      const beforeAt = text.substring(0, atIndex);
      const afterAt = text.substring(atIndex + 1);
      const spaceIndex = afterAt.indexOf(' ');
      const newlineIndex = afterAt.indexOf('\n');
      const endIndex = spaceIndex !== -1 && newlineIndex !== -1
        ? Math.min(spaceIndex, newlineIndex)
        : spaceIndex !== -1
        ? spaceIndex
        : newlineIndex !== -1
        ? newlineIndex
        : afterAt.length;
      
      const newText = beforeAt + `@${entity.username || entity.full_name || entity.name} ` + afterAt.substring(endIndex);
      setText(newText);
      setShowSearch(false);
      setSearchQuery('');
      
      // Add to tagged entities if not already present
      const isAlreadyTagged = taggedEntities.some(
        e => e.id === entity.id && e.type === entity.type
      );
      if (!isAlreadyTagged) {
        setTaggedEntities([...taggedEntities, {
          id: entity.id,
          type: entity.type || 'member',
          username: entity.username,
          name: entity.full_name || entity.name,
        }]);
      }
      
      // Focus back on input
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
    }
  };

  const removeTag = (entityId, entityType) => {
    setTaggedEntities(taggedEntities.filter(
      e => !(e.id === entityId && e.type === entityType)
    ));
    // Remove @mention from text
    const username = taggedEntities.find(e => e.id === entityId && e.type === entityType)?.username;
    if (username) {
      const mention = `@${username}`;
      const newText = text.replace(new RegExp(mention.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
      setText(newText);
    }
  };

  const renderSearchResult = ({ item }) => {
    if (!item || !item.id) return null;
    
    const profilePhotoUrl = item?.profile_photo_url;
    const fullName = item?.full_name || item?.name || 'Member';
    const username = item?.username || 'user';
    
    return (
      <TouchableOpacity
        style={styles.searchResultItem}
        onPress={() => selectEntity(item)}
      >
        {profilePhotoUrl ? (
          <Image source={{ uri: profilePhotoUrl }} style={styles.searchResultAvatar} />
        ) : (
          <View style={[styles.searchResultAvatar, styles.searchResultAvatarPlaceholder]}>
            <Ionicons name="person" size={18} color={COLORS.textLight} />
          </View>
        )}
        <View style={styles.searchResultInfo}>
          <Text style={styles.searchResultName} numberOfLines={1}>
            {fullName}
          </Text>
          <Text style={styles.searchResultUsername} numberOfLines={1}>
            @{username}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderTag = (entity, index) => {
    const username = entity.username || entity.name;
    return (
      <View key={`${entity.id}-${entity.type}-${index}`} style={styles.tagChip}>
        <Text style={styles.tagText}>@{username}</Text>
        <TouchableOpacity
          onPress={() => removeTag(entity.id, entity.type)}
          style={styles.tagRemove}
        >
          <Ionicons name="close-circle" size={16} color={COLORS.textLight} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.inputContainer}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={text}
          onChangeText={handleTextChange}
          onSelectionChange={handleSelectionChange}
          placeholder={placeholder}
          placeholderTextColor={placeholderTextColor}
          multiline
          maxLength={maxLength}
          textAlignVertical="top"
        />
        {taggedEntities.length > 0 && (
          <View style={styles.tagsContainer}>
            {taggedEntities.map((entity, index) => renderTag(entity, index))}
          </View>
        )}
      </View>

      {showSearch && (
        <View style={styles.searchContainer}>
          {isSearching ? (
            <View style={styles.searchLoading}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : searchResults.length > 0 ? (
            <ScrollView
              style={styles.searchResults}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              {searchResults
                .filter(item => item != null && item.id)
                .map((item, index) => (
                  <View key={item?.id ? `${item.id}-${item.type || 'member'}` : `search-result-${index}`}>
                    {renderSearchResult({ item })}
                  </View>
                ))}
            </ScrollView>
          ) : searchQuery.length >= 2 ? (
            <View style={styles.searchEmpty}>
              <Text style={styles.searchEmptyText}>No results found</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  inputContainer: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: COLORS.background,
  },
  input: {
    minHeight: 100,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: COLORS.textDark,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  tagText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },
  tagRemove: {
    padding: 2,
  },
  searchContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    marginTop: 4,
    maxHeight: 200,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  searchResults: {
    maxHeight: 200,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchResultAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  searchResultAvatarPlaceholder: {
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  searchResultUsername: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 2,
  },
  searchLoading: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  searchEmpty: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  searchEmptyText: {
    fontSize: 14,
    color: COLORS.textLight,
  },
});

export default MentionInput;

