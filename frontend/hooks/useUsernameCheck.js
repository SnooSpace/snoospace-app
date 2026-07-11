import { useState, useEffect, useRef } from 'react';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

/**
 * useUsernameCheck
 *
 * Debounced, abort-safe hook that hits GET /api/username/check?u=<username>
 * and returns real-time availability status + auto-generated suggestions.
 *
 * @param {string} username - Raw username string typed by the user
 * @returns {{ status: string, suggestions: string[] }}
 *   status: 'idle' | 'checking' | 'available' | 'taken' | 'error'
 *   suggestions: string[] — available alternatives when status === 'taken'
 *
 * Usage:
 *   const { status, suggestions } = useUsernameCheck(usernameFieldValue);
 *
 *   - status === 'checking'   → show a spinner
 *   - status === 'available'  → show a green check
 *   - status === 'taken'      → show a red X; render suggestion chips from `suggestions`
 *   - status === 'error'      → show a neutral warning (don't block the user)
 *   - status === 'idle'       → input is empty / too short; show nothing
 */
export function useUsernameCheck(username) {
  const [status, setStatus] = useState('idle');      // 'idle' | 'checking' | 'available' | 'taken' | 'error'
  const [suggestions, setSuggestions] = useState([]); // string[] of available alternatives

  const debounceRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    // Cancel any in-flight debounce + fetch from the previous render
    clearTimeout(debounceRef.current);
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    // Don't check if input is too short — saves network & avoids spurious 400s
    if (!username || username.length < 3) {
      setStatus('idle');
      setSuggestions([]);
      return;
    }

    setStatus('checking');

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(
          `${API_BASE_URL}/api/username/check?u=${encodeURIComponent(username)}`,
          { signal: controller.signal }
        );

        const data = await res.json();

        if (!res.ok) {
          // 400 (too short, reserved) — treat as taken so the user sees feedback
          setStatus('taken');
          setSuggestions(data.suggestions || []);
          return;
        }

        setStatus(data.available ? 'available' : 'taken');
        setSuggestions(data.suggestions || []);
      } catch (e) {
        // AbortError is expected when the component unmounts or username changes quickly
        if (e.name !== 'AbortError') {
          setStatus('error');
        }
      }
    }, 450); // 450 ms debounce — snappy but avoids hammering on fast typing

    return () => {
      clearTimeout(debounceRef.current);
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [username]);

  return { status, suggestions };
}
