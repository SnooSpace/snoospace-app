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
import * as accountManager from '../../utils/accountManager';

/**
 * Account Switcher Modal - Instagram-style
 * Shows all saved accounts with option to switch or add new account
 */
export default function AccountSwitcherModal({
  visible,
  onClose,
  onAccountSwitch,
  onAddAccount,
  onLoginRequired, // Callback when logged-out account is clicked
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
        const { getAuthToken, getAuthEmail, getRefreshToken } = require('../../api/auth');
        const token = await getAuthToken();
        const email = await getAuthEmail();
        const refreshToken = await getRefreshToken(); // Try to get refresh token
        
        if (token && currentProfile) {
          console.log('[AccountSwitcher] Auto-adding current account:', {
            id: currentProfile.id,
            email: email,
            tokenLength: token?.length,
            hasRefreshToken: !!refreshToken
          });
          
          const { addAccount } = require('../../api/auth');
          await addAccount({
            id: currentProfile.id,
            type: currentProfile.type || currentProfile.role || 'member',
            username: currentProfile.username,
            email: email,
            name: currentProfile.name || currentProfile.username,
            profilePicture: currentProfile.profile_photo_url || currentProfile.logo_url || null,
            authToken: token,
            refreshToken: refreshToken, // Use actual refresh token if available
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
    console.log('[AccountSwitcher] handleSwitchAccount called with account:', {
      id: account.id,
      username: account.username,
      email: account.email,
      isLoggedIn: account.isLoggedIn,
      currentAccountId: currentAccountId
    });

    // Convert both to strings for comparison
    if (String(account.id) === String(currentAccountId)) {
      console.log('[AccountSwitcher] Clicked on current account, closing modal');
      onClose();
      return;
    }

    // Check if account is logged out - navigate to login instead of switching
    if (account.isLoggedIn === false) {
      console.log('[AccountSwitcher] Account is logged out, navigating to login');
      onClose();
      if (onLoginRequired) {
        onLoginRequired(account);
      }
      return;
    }

    console.log('[AccountSwitcher] Account is logged in, validating token');
    
    // Validate access token before switching
    const accessToken = account.authToken;
    if (!accessToken) {
      console.warn('[AccountSwitcher] No access token for account');
      promptReAuthentication(account);
      return;
    }

    try {
      setSwitchingTo(account.id);
      
      // Check if token is valid
      const isValid = await validateToken(accessToken);
      
      if (!isValid) {
        console.log('[AccountSwitcher] Token is invalid or expired');
        
        // Check refresh token
        const refreshToken = account.refreshToken;
        if (!refreshToken || refreshToken.length < 20) {
          console.warn('[AccountSwitcher] Invalid/missing refresh token');
          promptReAuthentication(account);
          return;
        }
        
        // Token is expired but we have refresh token - let it try naturally
        // The API client will attempt refresh
        console.log('[AccountSwitcher] Token expired but has refresh token, proceeding');
      }

      // Switch account
      console.log('[AccountSwitcher] Calling switchAccount...');
      await switchAccount(account.id);      
      
      // Verify the token belongs to this account by checking JWT email
      try {
        const switchedToken = await (await import('../../api/auth')).getAuthToken();
        if (switchedToken) {
          // Decode JWT to get email
          const parts = switchedToken.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            const tokenEmail = payload.email;
            
            if (tokenEmail && tokenEmail !== account.email) {
              console.error('[AccountSwitcher] TOKEN M ISMATCH! Token email:', tokenEmail, 'Account email:', account.email);
              // Token doesn't match this account - re-auth required
              await accountManager.updateAccount(account.id, { isLoggedIn: false });
              promptReAuthentication(account);
              return;
            }
          }
        }
      } catch (e) {
        console.warn('[AccountSwitcher] Could not verify token email:', e);
      }
      
      // Navigate to correct screen
      if (onAccountSwitch) {
        console.log('[AccountSwitcher] Calling onAccountSwitch...');
        onAccountSwitch(account);
      }
      
      // Small delay to ensure navigation completes
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Close modal
      console.log('[AccountSwitcher] Closing modal after successful switch');
      onClose();
    } catch (error) {
      console.error('[AccountSwitcher] Error switching account:', error);
      
      // If it's a logged-out account error, navigate to login
      if (error.message && error.message.includes('logged out')) {
        console.log('[AccountSwitcher] Caught logged-out error, navigating to login');
        onClose();
        if (onLoginRequired) {
          onLoginRequired(account);
        }
      } else if (error.message && (error.message.includes('Unauthorized') || error.message.includes('Invalid'))) {
        // Token refresh failed
        console.log('[AccountSwitcher] Token refresh failed, prompting re-auth');
        promptReAuthentication(account);
      } else {
        Alert.alert('Error', 'Failed to switch account. Please try again.');
      }
    } finally {
      setSwitchingTo(null);
    }
  }

  // Helper function to prompt user to re-authenticate
  function promptReAuthentication(account) {
    onClose(); // Close switcher first
    
    // Mark account as logged out
    accountManager.updateAccount(account.id, { isLoggedIn: false });
    
    // Silently navigate to login - more seamless than showing alert
    if (onLoginRequired) {
      onLoginRequired(account);
    }
  }

  async function handleRemoveAccount(account) {
    Alert.alert(
      'Remove Account',
      `Remove @${account.username} from your accounts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await accountManager.removeAccount(account.id);
              loadAccounts(); // Refresh the list
            } catch (error) {
              Alert.alert('Error', error.message || 'Failed to remove account');
            }
          },
        },
      ]
    );
  }

  function renderAccountItem({ item }) {
    // Convert both to strings for comparison (IDs can be string or number)
    const isActive = String(item.id) === String(currentAccountId);
    const isSwitching = switchingTo === item.id;
    const isLoggedOut = item.isLoggedIn === false;
    const canRemove = !isActive || isLoggedOut;

    return (
      <View style={styles.accountRowContainer}>
        <TouchableOpacity
          style={[styles.accountRow, isLoggedOut && styles.accountRowLoggedOut]}
          onPress={() => handleSwitchAccount(item)}
          disabled={isSwitching}
        >
          <Image
            source={{ uri: item.profilePicture || 'https://via.placeholder.com/50' }}
            style={[styles.avatar, isLoggedOut && styles.avatarLoggedOut]}
          />
          
          <View style={styles.accountInfo}>
            <Text style={[styles.username, isLoggedOut && styles.usernameLoggedOut]}>
              {item.username}
            </Text>
            {isLoggedOut ? (
              <Text style={styles.loginRequired}>Tap to log in</Text>
            ) : item.unreadCount > 0 ? (
              <View style={styles.badgeContainer}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.unreadCount}</Text>
                </View>
                <Text style={styles.badgeLabel}>notifications</Text>
              </View>
            ) : null}
          </View>

          {isSwitching ? (
            <ActivityIndicator size="small" color="#0095F6" />
          ) : isActive && !isLoggedOut ? (
            <Ionicons name="checkmark-circle" size={24} color="#0095F6" />
          ) : null}
        </TouchableOpacity>
        
        {canRemove && (
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemoveAccount(item)}
          >
            <Ionicons name="close-circle" size={22} color="#FF3B30" />
          </TouchableOpacity>
        )}
      </View>
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
  accountRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  accountRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 12,
  },
  accountRowLoggedOut: {
    opacity: 0.6,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E5E5EA',
  },
  avatarLoggedOut: {
    opacity: 0.5,
  },
  accountInfo: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1D1D1F',
  },
  usernameLoggedOut: {
    color: '#8E8E93',
  },
  loginRequired: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
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
  removeButton: {
    padding: 8,
    marginLeft: 8,
  },
});

AccountSwitcherModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onAccountSwitch: PropTypes.func,
  onAddAccount: PropTypes.func.isRequired,
  onLoginRequired: PropTypes.func, // Called when logged-out account is clicked
  currentAccountId: PropTypes.string,
  currentProfile: PropTypes.object, // Current user profile data
};
