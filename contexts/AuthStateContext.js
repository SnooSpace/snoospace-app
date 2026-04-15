import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import EventEmitter from "eventemitter3";
import { getActiveAccount } from "../api/auth";

// Global event emitter for auth events
const authEventEmitter = new EventEmitter();

// Make it globally accessible for accountManager to emit events
if (typeof global !== "undefined") {
  global.authEventEmitter = authEventEmitter;
}

// Context types
const AuthStateContext = createContext(null);

/**
 * Auth State Provider
 * Provides global auth state management including unexpected logout handling
 */
export function AuthStateProvider({ children }) {
  const [isUnexpectedlyLoggedOut, setIsUnexpectedlyLoggedOut] = useState(false);
  const [logoutDetails, setLogoutDetails] = useState(null);
  const [activeAccountEmail, setActiveAccountEmail] = useState(null);

  // Check if current account is logged out on mount
  useEffect(() => {
    checkAuthState();

    // Listen for unexpected logout events
    const handleUnexpectedLogout = (details) => {
      console.log(
        "[AuthStateProvider] Received unexpectedLogout event:",
        details,
      );
      setIsUnexpectedlyLoggedOut(true);
      setLogoutDetails(details);
    };

    authEventEmitter.on("unexpectedLogout", handleUnexpectedLogout);

    return () => {
      authEventEmitter.off("unexpectedLogout", handleUnexpectedLogout);
    };
  }, []);

  // Check auth state periodically and on focus
  const checkAuthState = useCallback(async () => {
    try {
      const activeAccount = await getActiveAccount();

      if (activeAccount) {
        setActiveAccountEmail(activeAccount.email);

        if (activeAccount.isLoggedIn === false) {
          console.log(
            "[AuthStateProvider] Active account is logged out:",
            activeAccount.email,
          );
          setIsUnexpectedlyLoggedOut(true);
          setLogoutDetails({
            accountId: activeAccount.id,
            email: activeAccount.email,
            reason: activeAccount.logoutReason || "Session expired",
            source: activeAccount.logoutSource || "unknown",
          });
        } else {
          // Account is logged in - clear any stale logout state
          if (isUnexpectedlyLoggedOut) {
            setIsUnexpectedlyLoggedOut(false);
            setLogoutDetails(null);
          }
        }
      }
    } catch (error) {
      console.error("[AuthStateProvider] Error checking auth state:", error);
    }
  }, [isUnexpectedlyLoggedOut]);

  // Clear the unexpected logout state (e.g., after user acknowledges)
  const clearLogoutState = useCallback(() => {
    setIsUnexpectedlyLoggedOut(false);
    setLogoutDetails(null);
  }, []);

  // Force re-check of auth state
  const refreshAuthState = useCallback(async () => {
    await checkAuthState();
  }, [checkAuthState]);

  const value = {
    isUnexpectedlyLoggedOut,
    logoutDetails,
    activeAccountEmail,
    clearLogoutState,
    refreshAuthState,
  };

  return (
    <AuthStateContext.Provider value={value}>
      {children}
    </AuthStateContext.Provider>
  );
}

/**
 * Hook to access auth state
 */
export function useAuthState() {
  const context = useContext(AuthStateContext);
  if (!context) {
    // Return default values if used outside provider (graceful degradation)
    return {
      isUnexpectedlyLoggedOut: false,
      logoutDetails: null,
      activeAccountEmail: null,
      clearLogoutState: () => {},
      refreshAuthState: () => Promise.resolve(),
    };
  }
  return context;
}

/**
 * Export event emitter for direct use if needed
 */
export { authEventEmitter };
