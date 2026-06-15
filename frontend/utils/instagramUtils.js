/**
 * instagramUtils.js
 *
 * Pure utility functions for Instagram username handling.
 * No React, no side-effects — safe to use anywhere.
 */

// Regex: letters, numbers, dots, underscores, 1–30 chars
const IG_USERNAME_REGEX = /^[a-zA-Z0-9._]{1,30}$/;

// Matches full instagram.com URLs with optional www, optional trailing slash
const IG_URL_REGEX =
  /^https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9._]{1,30})\/?(?:\?.*)?$/i;

/**
 * normaliseInstagramInput
 *
 * Accepts any of:
 *   - "username"
 *   - "@username"
 *   - "https://instagram.com/username"
 *   - "https://www.instagram.com/username"
 *
 * Returns the clean username string, or null if the input is empty.
 * Throws an Error with a user-friendly message if the format is invalid.
 */
export function normaliseInstagramInput(raw) {
  if (!raw || typeof raw !== 'string') return null;

  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '@') return null;

  // Strip URL prefix first
  const urlMatch = trimmed.match(IG_URL_REGEX);
  if (urlMatch) {
    return urlMatch[1]; // captured username segment
  }

  // If it looks like a URL but didn't match, reject it
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    throw new Error('Invalid Instagram URL. Use the format: https://instagram.com/username');
  }

  // Strip leading @
  const username = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;

  if (username === '') return null;

  if (!IG_USERNAME_REGEX.test(username)) {
    throw new Error('Instagram usernames can only contain letters, numbers, dots, and underscores.');
  }

  return username;
}

/**
 * validateInstagramUsername
 *
 * Validates an already-normalised (no @ prefix, no URL) username.
 * Returns { valid: boolean, error?: string }
 */
export function validateInstagramUsername(username) {
  if (!username || username.trim() === '') {
    return { valid: true }; // empty = allowed (clears the field)
  }
  if (!IG_USERNAME_REGEX.test(username)) {
    return {
      valid: false,
      error: 'Only letters, numbers, dots, and underscores are allowed.',
    };
  }
  return { valid: true };
}

/**
 * buildInstagramUrl
 *
 * Builds the public profile URL for a given clean username.
 * Safe to call with null/undefined — returns null.
 */
export function buildInstagramUrl(username) {
  if (!username) return null;
  return `https://www.instagram.com/${username}`;
}
