/**
 * Session Manager V2
 * Handles device-based sessions with V2 backend API
 * Replaces Supabase-based authentication with custom JWT sessions
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import { encryptToken, decryptToken } from "./encryption";

const DEVICE_ID_KEY = "@device_id";
const SESSIONS_KEY = "@sessions_v2";
const ACTIVE_SESSION_KEY = "@active_session_v2";
const MAX_ACCOUNTS = 5;

// Backend URL - uses same as client.js
const BACKEND_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://192.168.1.11:5000";

/**
 * Get device info for analytics tracking
 * Returns platform, OS version, and basic device info
 */
function getDeviceInfo() {
  return {
    platform: Platform.OS, // 'ios', 'android', 'web'
    osVersion: String(Platform.Version), // e.g., '18.2', '34'
    deviceModel: Platform.select({
      ios: "iOS Device",
      android: "Android Device",
      default: "Unknown Device",
    }),
  };
}

// ============================================================
// Device ID Management
// ============================================================

/**
 * Get or create a unique device ID
 * Persisted in AsyncStorage, created once per app install
 */
export async function getDeviceId() {
  try {
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);

    if (!deviceId) {
      // Generate new UUID v4
      deviceId = Crypto.randomUUID();
      await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
      console.log("[SessionManager] Generated new device ID:", deviceId);
    }

    return deviceId;
  } catch (error) {
    console.error("[SessionManager] Error getting device ID:", error);
    // Fallback to random ID if crypto fails
    const fallbackId = `fallback_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, fallbackId);
    return fallbackId;
  }
}

// ============================================================
// V2 API Functions
// ============================================================

/**
 * Send OTP to email via V2 endpoint
 */
export async function sendOtp(email) {
  const response = await fetch(`${BACKEND_BASE_URL}/auth/v2/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.toLowerCase().trim() }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to send OTP");
  }

  return data;
}

/**
 * Verify OTP and get accounts list
 * Returns:
 * - { emailVerified: true, accounts: [], requiresAccountCreation: true } - No accounts
 * - { emailVerified: true, accounts: [acc], autoLogin: true, session?, user? } - Single account
 * - { emailVerified: true, accounts: [...], requiresAccountSelection: true } - Multiple accounts
 */
export async function verifyOtp(email, token) {
  const deviceId = await getDeviceId();
  const deviceInfo = getDeviceInfo();

  console.log(
    "[SessionManager] Verifying OTP for:",
    email,
    "deviceId:",
    deviceId,
    "deviceInfo:",
    deviceInfo
  );

  const response = await fetch(`${BACKEND_BASE_URL}/auth/v2/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: email.toLowerCase().trim(),
      token,
      deviceId,
      deviceInfo,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to verify OTP");
  }

  console.log("[SessionManager] OTP verification result:", {
    emailVerified: data.emailVerified,
    accountCount: data.accounts?.length,
    requiresAccountCreation: data.requiresAccountCreation,
    requiresAccountSelection: data.requiresAccountSelection,
    autoLogin: data.autoLogin,
  });

  // If auto-login happened, save the session
  if (data.autoLogin && data.session) {
    await saveSession(data.user, data.session);
  }

  return data;
}

/**
 * Create session for a specific account after selection
 */
export async function createSession(userId, userType, email) {
  const deviceId = await getDeviceId();
  const deviceInfo = getDeviceInfo();

  console.log(
    "[SessionManager] Creating session for:",
    userType,
    userId,
    "with deviceInfo:",
    deviceInfo
  );

  const response = await fetch(`${BACKEND_BASE_URL}/auth/v2/create-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, userType, deviceId, email, deviceInfo }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to create session");
  }

  // Save session locally
  await saveSession(data.user, data.session);

  return data;
}

/**
 * Refresh access token using refresh token
 */
export async function refreshTokens(refreshToken) {
  const deviceId = await getDeviceId();

  console.log("[SessionManager] Refreshing tokens");
  console.log("[SessionManager] Refresh token to send:", {
    length: refreshToken?.length,
    preview: refreshToken
      ? `${refreshToken.substring(0, 20)}...${refreshToken.substring(
          refreshToken.length - 10
        )}`
      : "null",
    isHex: refreshToken ? /^[0-9a-f]+$/i.test(refreshToken) : false,
  });
  console.log("[SessionManager] Device ID:", deviceId);

  const response = await fetch(`${BACKEND_BASE_URL}/auth/v2/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken, deviceId }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to refresh token");
  }

  console.log("[SessionManager] Token refresh successful");

  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt: data.expiresAt,
  };
}

/**
 * Logout - delete session for specific account
 */
export async function logout(userId, userType) {
  const deviceId = await getDeviceId();

  console.log("[SessionManager] Logging out:", userType, userId);

  try {
    await fetch(`${BACKEND_BASE_URL}/auth/v2/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, userType, deviceId }),
    });
  } catch (error) {
    console.warn(
      "[SessionManager] Logout API error (continuing anyway):",
      error.message
    );
  }

  // Remove local session
  await removeLocalSession(userId, userType);
}

/**
 * Get all sessions for this device from server
 * Useful for restoring multi-account state on app launch
 */
export async function getDeviceSessions() {
  const deviceId = await getDeviceId();

  console.log("[SessionManager] Fetching device sessions");

  try {
    const response = await fetch(
      `${BACKEND_BASE_URL}/auth/v2/sessions?deviceId=${deviceId}`
    );
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to get sessions");
    }

    return data.sessions || [];
  } catch (error) {
    console.warn(
      "[SessionManager] Failed to fetch device sessions:",
      error.message
    );
    return [];
  }
}

// ============================================================
// Local Session Storage
// ============================================================

/**
 * Save session locally (encrypted)
 */
async function saveSession(user, session) {
  try {
    const sessionsJson = await AsyncStorage.getItem(SESSIONS_KEY);
    let rawSessions = sessionsJson ? JSON.parse(sessionsJson) : [];
    const compositeId = `${user.type}_${user.id}`;

    // === DIAGNOSTIC LOG: Dump raw storage state ===
    console.log("🔍 [SessionManager] saveSession called for:", compositeId);
    console.log("🔍 [SessionManager] Raw sessions in storage:", rawSessions.length);
    for (let i = 0; i < rawSessions.length; i++) {
      const s = rawSessions[i];
      console.log(`🔍 [SessionManager] Session[${i}]:`, {
        id: s.id,
        type: s.type,
        email: s.email,
        compositeId: `${s.type}_${s.id}`,
        hasAccessToken: !!s.accessToken,
        accessTokenLength: s.accessToken?.length || 0,
        isLoggedIn: s.isLoggedIn,
      });
    }

    const existingIndex = rawSessions.findIndex(
      (s) => `${s.type}_${s.id}` === compositeId
    );
    console.log("🔍 [SessionManager] existingIndex:", existingIndex);

    // CRITICAL FIX: Purge invalid sessions before checking limit.
    // decryptToken() NEVER throws - it returns null on failure. So we must
    // check the return value, not catch exceptions.
    if (existingIndex === -1) {
      const validSessions = [];
      for (const s of rawSessions) {
        const decrypted = await decryptToken(s.accessToken);
        if (decrypted && decrypted.length > 0) {
          validSessions.push(s);
        } else {
          console.warn(
            "🧹 [SessionManager] Removing invalid session (decryption returned null/empty):",
            s.id, s.email, s.type
          );
        }
      }
      if (validSessions.length !== rawSessions.length) {
        console.log(
          "🧹 [SessionManager] Purged", rawSessions.length - validSessions.length,
          "invalid sessions. Remaining:", validSessions.length
        );
        rawSessions = validSessions;
        await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(rawSessions));
      } else {
        console.log("🔍 [SessionManager] All", rawSessions.length, "sessions passed decryption check");
      }
    }

    // Re-check existingIndex against (possibly cleaned) rawSessions
    const finalExistingIndex = rawSessions.findIndex(
      (s) => `${s.type}_${s.id}` === compositeId
    );

    console.log("🔍 [SessionManager] Final state: sessions=" + rawSessions.length +
      ", finalExistingIndex=" + finalExistingIndex +
      ", MAX_ACCOUNTS=" + MAX_ACCOUNTS);

    if (finalExistingIndex === -1 && rawSessions.length >= MAX_ACCOUNTS) {
      // CRITICAL FIX: Before giving up, reconcile local sessions against the backend.
      // Accounts may have been deleted from the admin panel, leaving orphaned local
      // sessions with valid (but useless) tokens that still pass decryption.
      console.log("⚠️ [SessionManager] At limit (" + rawSessions.length + "/" + MAX_ACCOUNTS +
        "). Reconciling with backend...");

      try {
        const deviceId = await getDeviceId();
        const response = await fetch(
          `${BACKEND_BASE_URL}/auth/v2/sessions?deviceId=${deviceId}`
        );
        const data = await response.json();
        const serverSessions = data.sessions || [];

        // Build a set of compositeIds the server recognizes
        const serverIds = new Set(
          serverSessions.map((s) => `${s.user_type}_${s.user_id}`)
        );
        console.log("🔍 [SessionManager] Server recognizes", serverIds.size, "sessions:",
          [...serverIds].join(", "));

        // Remove local sessions the server doesn't know about
        const reconciledSessions = rawSessions.filter((s) => {
          const id = `${s.type}_${s.id}`;
          if (serverIds.has(id)) {
            return true;
          }
          console.warn("🧹 [SessionManager] Removing orphaned session (not on server):",
            id, s.email);
          return false;
        });

        if (reconciledSessions.length !== rawSessions.length) {
          console.log("🧹 [SessionManager] Removed",
            rawSessions.length - reconciledSessions.length, "orphaned sessions. Remaining:",
            reconciledSessions.length);
          rawSessions = reconciledSessions;
          await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(rawSessions));
        }
      } catch (reconcileError) {
        console.warn("⚠️ [SessionManager] Backend reconciliation failed (continuing):",
          reconcileError.message);
      }

      // Re-check after reconciliation
      const postReconcileIndex = rawSessions.findIndex(
        (s) => `${s.type}_${s.id}` === compositeId
      );
      if (postReconcileIndex === -1 && rawSessions.length >= MAX_ACCOUNTS) {
        console.error("❌ [SessionManager] BLOCKED: Still have", rawSessions.length,
          "valid sessions after reconciliation:");
        rawSessions.forEach((s, i) => {
          console.error(`❌ [SessionManager] Session[${i}]:`, s.id, s.type, s.email);
        });
        throw new Error(`Maximum ${MAX_ACCOUNTS} accounts allowed`);
      }
    }

    // Encrypt tokens for new/updated session
    const encryptedSession = {
      id: String(user.id),
      type: user.type,
      email: user.email,
      name: user.name,
      username: user.username,
      avatar: user.avatar,
      accessToken: await encryptToken(session.accessToken),
      refreshToken: await encryptToken(session.refreshToken),
      expiresAt: session.expiresAt,
      lastActive: Date.now(),
      isLoggedIn: true,
    };

    if (finalExistingIndex !== -1) {
      rawSessions[finalExistingIndex] = encryptedSession;
    } else {
      rawSessions.push(encryptedSession);
    }

    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(rawSessions));
    await AsyncStorage.setItem(ACTIVE_SESSION_KEY, compositeId);

    console.log("✅ [SessionManager] Session saved for:", compositeId);
  } catch (error) {
    console.error("[SessionManager] Error saving session:", error);
    throw error;
  }
}

/**
 * Get all local sessions (decrypted)
 */
export async function getAllLocalSessions() {
  try {
    const sessionsJson = await AsyncStorage.getItem(SESSIONS_KEY);
    if (!sessionsJson) return [];

    const sessions = JSON.parse(sessionsJson);
    const decryptedSessions = [];

    for (const session of sessions) {
      try {
        decryptedSessions.push({
          ...session,
          accessToken: await decryptToken(session.accessToken),
          refreshToken: session.refreshToken
            ? await decryptToken(session.refreshToken)
            : null,
        });
      } catch (error) {
        console.warn(
          "[SessionManager] Skipping corrupted session:",
          session.id
        );
      }
    }

    return decryptedSessions;
  } catch (error) {
    console.error("[SessionManager] Error loading sessions:", error);
    return [];
  }
}

/**
 * Get active session
 */
export async function getActiveSession() {
  try {
    const activeId = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);
    if (!activeId) return null;

    const sessions = await getAllLocalSessions();
    return sessions.find((s) => `${s.type}_${s.id}` === activeId) || null;
  } catch (error) {
    console.error("[SessionManager] Error getting active session:", error);
    return null;
  }
}

/**
 * Switch to a different session
 */
export async function switchSession(userId, userType) {
  try {
    const compositeId = `${userType}_${userId}`;
    const sessions = await getAllLocalSessions();
    const session = sessions.find((s) => `${s.type}_${s.id}` === compositeId);

    if (!session) {
      throw new Error("Session not found");
    }

    if (session.isLoggedIn === false) {
      throw new Error("This account is logged out. Please log in again.");
    }

    await AsyncStorage.setItem(ACTIVE_SESSION_KEY, compositeId);

    // Update last active
    await updateLocalSession(compositeId, { lastActive: Date.now() });

    console.log("[SessionManager] Switched to session:", compositeId);
    return session;
  } catch (error) {
    console.error("[SessionManager] Error switching session:", error);
    throw error;
  }
}

/**
 * Update local session data
 */
export async function updateLocalSession(compositeId, updates) {
  try {
    const sessionsJson = await AsyncStorage.getItem(SESSIONS_KEY);
    if (!sessionsJson) return false;

    const sessions = JSON.parse(sessionsJson);
    const index = sessions.findIndex(
      (s) => `${s.type}_${s.id}` === compositeId
    );

    if (index === -1) return false;

    // Encrypt tokens if being updated
    if (updates.accessToken) {
      updates.accessToken = await encryptToken(updates.accessToken);
    }
    if (updates.refreshToken) {
      updates.refreshToken = await encryptToken(updates.refreshToken);
    }

    sessions[index] = { ...sessions[index], ...updates };
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));

    return true;
  } catch (error) {
    console.error("[SessionManager] Error updating session:", error);
    return false;
  }
}

/**
 * Remove local session
 */
async function removeLocalSession(userId, userType) {
  try {
    const compositeId = `${userType}_${userId}`;
    const sessionsJson = await AsyncStorage.getItem(SESSIONS_KEY);
    if (!sessionsJson) return;

    const sessions = JSON.parse(sessionsJson);
    const filtered = sessions.filter(
      (s) => `${s.type}_${s.id}` !== compositeId
    );

    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(filtered));

    // If this was active, switch to another
    const activeId = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);
    if (activeId === compositeId) {
      const nextSession = filtered.find((s) => s.isLoggedIn !== false);
      if (nextSession) {
        await AsyncStorage.setItem(
          ACTIVE_SESSION_KEY,
          `${nextSession.type}_${nextSession.id}`
        );
      } else {
        await AsyncStorage.removeItem(ACTIVE_SESSION_KEY);
      }
    }

    console.log("[SessionManager] Removed session:", compositeId);
  } catch (error) {
    console.error("[SessionManager] Error removing session:", error);
  }
}

/**
 * Clear all local sessions
 */
export async function clearAllSessions() {
  try {
    await AsyncStorage.removeItem(SESSIONS_KEY);
    await AsyncStorage.removeItem(ACTIVE_SESSION_KEY);
    console.log("[SessionManager] Cleared all sessions");
  } catch (error) {
    console.error("[SessionManager] Error clearing sessions:", error);
  }
}

/**
 * Logout current session and switch to next available
 */
export async function logoutCurrentSession() {
  try {
    const activeSession = await getActiveSession();
    if (!activeSession) {
      return { switchToSession: null, navigateToLanding: true };
    }

    // Logout from server
    await logout(activeSession.id, activeSession.type);

    // Find next available session
    const sessions = await getAllLocalSessions();
    const nextSession = sessions.find(
      (s) =>
        `${s.type}_${s.id}` !== `${activeSession.type}_${activeSession.id}` &&
        s.isLoggedIn !== false
    );

    if (nextSession) {
      await switchSession(nextSession.id, nextSession.type);
      return { switchToSession: nextSession, navigateToLanding: false };
    }

    return { switchToSession: null, navigateToLanding: true };
  } catch (error) {
    console.error("[SessionManager] Error logging out:", error);
    throw error;
  }
}

export default {
  getDeviceId,
  sendOtp,
  verifyOtp,
  createSession,
  refreshTokens,
  logout,
  getDeviceSessions,
  getAllLocalSessions,
  getActiveSession,
  switchSession,
  updateLocalSession,
  clearAllSessions,
  logoutCurrentSession,
};
