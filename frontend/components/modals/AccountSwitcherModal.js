import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PropTypes from 'prop-types';
import { getAllAccounts, switchAccount, validateToken } from '../../api/auth';

/**
 * Account Switcher Modal - Instagram-style
 * Shows all saved accounts with option to switch or add new account
 */
export default function AccountSwitcherModal({
  visible,
  onClose,
  onAccountSwitch,
  onAddAccount,
  currentAccountId,
  currentProfile, // Add this prop to get current user data
}) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [switchingTo, setSwitchingTo] = useState(null);

  useEffect(() => {
    if (visible) {
      loadAccounts();
    }
  }, [visible]);

  async function loadAccounts() {
    try {
      const allAccounts = await getAllAccounts();
      
      // If no accounts exist but user is logged in, add current account
      if (allAccounts.length === 0 && currentProfile) {
        const { getAuthToken, getAuthEmail } = require('../../api/auth');
        const token = await getAuthToken();
        const email = await getAuthEmail();
        
        if (token && currentProfile) {
          const { addAccount } = require('../../api/auth');
          await addAccount({
            id: currentProfile.id,
            type: currentProfile.type || currentProfile.role || 'member',
            username: currentProfile.username,
            email: email,
            name: currentProfile.name || currentProfile.username,
            profilePicture: currentProfile.profile_photo_url || currentProfile.logo_url || null,
            authToken: token,
            refreshToken: null, // May not have refresh token in old sessions
          });
          // Reload accounts after adding
          const updatedAccounts = await getAllAccounts();
          setAccounts(updatedAccounts);
          return;
        }
      }
      
      setAccounts(allAccounts);
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  }

  async function handleSwitchAccount(account) {
    if (account.id === currentAccountId) {
      onClose();
      return;
    }

    try {
      setSwitchingTo(account.id);
      
      // Validate token before switching
      const isValid = await validateToken(account.authToken);
      
      if (!isValid) {
        Alert.alert(
          'Session Expired',
          'This account\'s session has expired. Please log in again.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Log In',
              onPress: () => {
                onClose();
                onAddAccount(true); // Pass flag to indicate re-login
              },
            },
          ]
        );
        setSwitchingTo(null);
        return;
      }

      // Switch account
      await switchAccount(account.id);
      
      // Notify parent to refresh UI
      if (onAccountSwitch) {
        onAccountSwitch(account);
      }
      
      onClose();
    } catch (error) {
      console.error('Error switching account:', error);
      Alert.alert('Error', 'Failed to switch account. Please try again.');
    } finally {
      setSwitchingTo(null);
    }
  }

  function renderAccountItem({ item }) {
    const isActive = item.id === currentAccountId;
    const isSwitching = switchingTo === item.id;

    return (
      <TouchableOpacity
        style={styles.accountRow}
        onPress={() => handleSwitchAccount(item)}
        disabled={isSwitching}
      >
        <Image
          source={{ uri: item.profilePicture || 'https://via.placeholder.com/50' }}
          style={styles.avatar}
        />
        
        <View style={styles.accountInfo}>
          <Text style={styles.username}>{item.username}</Text>
          {item.unreadCount > 0 && (
            <View style={styles.badgeContainer}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.unreadCount}</Text>
              </View>
              <Text style={styles.badgeLabel}>notifications</Text>
            </View>
          )}
        </View>

        {isSwitching ? (
          <ActivityIndicator size="small" color="#0095F6" />
        ) : isActive ? (
          <Ionicons name="checkmark-circle" size={24} color="#0095F6" />
        ) : null}
      </TouchableOpacity>
    );
  }

  const canAddMore = accounts.length < 5;

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

          {/* Account List */}
          <FlatList
            data={accounts}
            keyExtractor={(item) => item.id}
            renderItem={renderAccountItem}
            style={styles.accountList}
            contentContainerStyle={styles.listContent}
          />

          {/* Add Account Button */}
          <TouchableOpacity
            style={[
              styles.addAccountButton,
              !canAddMore && styles.addAccountButtonDisabled,
            ]}
            onPress={() => {
              onClose();
              onAddAccount();
            }}
            disabled={!canAddMore}
          >
            <Ionicons
              name="add-circle-outline"
              size={24}
              color={canAddMore ? '#1D1D1F' : '#8E8E93'}
            />
            <Text
              style={[
                styles.addAccountText,
                !canAddMore && styles.addAccountTextDisabled,
              ]}
            >
              Add account
            </Text>
            {!canAddMore && (
              <Text style={styles.maxReachedText}>(Max reached)</Text>
            )}
          </TouchableOpacity>

          {/* SnooSpace Branding */}
          <View style={styles.footer}>
            <Text style={styles.metaText}>SnooSpace</Text>
          </View>
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
    maxHeight: '80%',
    paddingBottom: 30,
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
  accountList: {
    maxHeight: 400,
  },
  listContent: {
    paddingHorizontal: 20,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E5E5EA',
  },
  accountInfo: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1D1D1F',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  badge: {
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  badgeLabel: {
    fontSize: 13,
    color: '#8E8E93',
  },
  addAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    marginTop: 10,
  },
  addAccountButtonDisabled: {
    opacity: 0.5,
  },
  addAccountText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1D1D1F',
  },
  addAccountTextDisabled: {
    color: '#8E8E93',
  },
  maxReachedText: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 4,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 20,
  },
  metaText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
  },
});

AccountSwitcherModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onAccountSwitch: PropTypes.func,
  onAddAccount: PropTypes.func.isRequired,
  currentAccountId: PropTypes.string,
  currentProfile: PropTypes.object, // Current user profile data
};
