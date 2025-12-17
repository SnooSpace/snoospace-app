/**
 * Account Picker Modal
 * Shown when OTP verification returns multiple accounts for the same email
 * User selects which account to log into
 */
import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import PropTypes from 'prop-types';

// Type badges and colors
const TYPE_CONFIG = {
  member: { label: 'Member', color: '#5f27cd', icon: 'person' },
  community: { label: 'Community', color: '#00d2d3', icon: 'people' },
  sponsor: { label: 'Sponsor', color: '#ff9f43', icon: 'business' },
  venue: { label: 'Venue', color: '#10ac84', icon: 'location' },
};

// Generate gradient colors from name (same logic as AvatarGenerator)
function getGradientForName(name) {
  const gradients = [
    ['#667eea', '#764ba2'],
    ['#f093fb', '#f5576c'],
    ['#4facfe', '#00f2fe'],
    ['#43e97b', '#38f9d7'],
    ['#fa709a', '#fee140'],
    ['#a8edea', '#fed6e3'],
    ['#5ee7df', '#b490ca'],
    ['#d299c2', '#fef9d7'],
  ];
  
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return gradients[Math.abs(hash) % gradients.length];
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0]?.substring(0, 2).toUpperCase() || '?';
}

export default function AccountPickerModal({
  visible,
  onClose,
  accounts,
  onSelectAccount,
  loading,
  email,
}) {
  const renderAccountItem = ({ item }) => {
    const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.member;
    const gradient = getGradientForName(item.name || item.username);
    
    return (
      <TouchableOpacity
        style={styles.accountItem}
        onPress={() => onSelectAccount(item)}
        disabled={loading}
      >
        {/* Avatar */}
        <LinearGradient
          colors={gradient}
          style={styles.avatar}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.avatarText}>
            {getInitials(item.name || item.username)}
          </Text>
        </LinearGradient>
        
        {/* Account info */}
        <View style={styles.accountInfo}>
          <Text style={styles.accountName} numberOfLines={1}>
            {item.name || item.username}
          </Text>
          <Text style={styles.accountUsername} numberOfLines={1}>
            @{item.username}
          </Text>
        </View>
        
        {/* Type badge */}
        <View style={[styles.typeBadge, { backgroundColor: config.color + '20' }]}>
          <Ionicons name={config.icon} size={12} color={config.color} />
          <Text style={[styles.typeBadgeText, { color: config.color }]}>
            {config.label}
          </Text>
        </View>
        
        {/* Arrow */}
        <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
      </TouchableOpacity>
    );
  };
  
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modalContent}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Handle bar */}
          <View style={styles.handleBar} />
          
          {/* Title */}
          <Text style={styles.title}>Choose Account</Text>
          <Text style={styles.subtitle}>
            Multiple accounts found for {email}
          </Text>
          
          {/* Loading indicator */}
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#5f27cd" />
              <Text style={styles.loadingText}>Logging in...</Text>
            </View>
          )}
          
          {/* Account list */}
          {!loading && (
            <FlatList
              data={accounts}
              renderItem={renderAccountItem}
              keyExtractor={(item) => `${item.type}_${item.id}`}
              style={styles.accountList}
              showsVerticalScrollIndicator={false}
            />
          )}
          
          {/* Cancel button */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 30,
    maxHeight: '70%',
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E5EA',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1D1D1F',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 24,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
  },
  accountList: {
    maxHeight: 300,
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  accountInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  accountName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1D1D1F',
    marginBottom: 2,
  },
  accountUsername: {
    fontSize: 14,
    color: '#8E8E93',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  cancelButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  cancelButtonText: {
    color: '#8E8E93',
    fontSize: 16,
    fontWeight: '500',
  },
});

AccountPickerModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  accounts: PropTypes.array,
  onSelectAccount: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  email: PropTypes.string,
};

AccountPickerModal.defaultProps = {
  accounts: [],
  loading: false,
  email: '',
};
