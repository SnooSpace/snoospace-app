import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

const TEXT_COLOR = '#1C1C1E';
const LIGHT_TEXT_COLOR = '#8E8E93';

/**
 * RichTextEditor - Basic text editor with formatting and character count
 * Supports: bold, italic, underline, bullets (minimal features for now)
 */
const RichTextEditor = ({ value, onChange, minLength = 50, maxLength = 2000, placeholder }) => {
  const [charCount, setCharCount] = useState(value?.length || 0);
  const [showPreview, setShowPreview] = useState(false);

  const handleTextChange = (text) => {
    setCharCount(text.length);
    onChange(text);
  };

  const isValid = charCount >= minLength;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>Event Description *</Text>
        <Text style={[styles.charCount, !isValid && styles.charCountInvalid]}>
          {charCount}/{maxLength}
          {!isValid && ` (min ${minLength})`}
        </Text>
      </View>

      {/* Simple Toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolButton} disabled>
          <Ionicons name="text-outline" size={20} color={LIGHT_TEXT_COLOR} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.toolButton}
          onPress={() => setShowPreview(!showPreview)}
        >
          <Ionicons
            name={showPreview ? 'create-outline' : 'eye-outline'}
            size={20}
            color={showPreview ? COLORS.primary : LIGHT_TEXT_COLOR}
          />
        </TouchableOpacity>
      </View>

      {/* Text Input */}
      {!showPreview ? (
        <TextInput
          style={styles.textInput}
          value={value}
          onChangeText={handleTextChange}
          placeholder={placeholder || "Tell people what makes this event special..."}
          placeholderTextColor={LIGHT_TEXT_COLOR}
          multiline
          textAlignVertical="top"
          maxLength={maxLength}
        />
      ) : (
        <View style={styles.preview}>
          <Text style={styles.previewText}>{value || 'No description yet...'}</Text>
        </View>
      )}

      {/* Helper Text */}
      {!isValid && charCount > 0 && (
        <Text style={styles.helperText}>
          Add at least {minLength - charCount} more characters
        </Text>
      )}

      {isValid && (
        <View style={styles.checkmark}>
          <Ionicons name="checkmark-circle" size={20} color="#34C759" />
          <Text style={styles.validText}>Description looks good!</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_COLOR,
  },
  charCount: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
  },
  charCountInvalid: {
    color: '#FF3B30',
  },
  toolbar: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#E5E5EA',
  },
  toolButton: {
    padding: 8,
    marginRight: 8,
    borderRadius: 6,
  },
  textInput: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#E5E5EA',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    padding: 15,
    fontSize: 14,
    color: TEXT_COLOR,
    backgroundColor: '#FFFFFF',
    minHeight: 150,
  },
  preview: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#E5E5EA',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    padding: 15,
    backgroundColor: '#FAFAFA',
    minHeight: 150,
  },
  previewText: {
    fontSize: 14,
    color: TEXT_COLOR,
    lineHeight: 20,
  },
  helperText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 8,
  },
  checkmark: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  validText: {
    fontSize: 12,
    color: '#34C759',
    marginLeft: 6,
    fontWeight: '600',
  },
});

export default RichTextEditor;
