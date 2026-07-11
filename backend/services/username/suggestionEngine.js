/**
 * Username Suggestion Engine
 *
 * Pure function module — no I/O, no side effects.
 * Generates a pool of candidate usernames from a raw base string.
 * The caller is responsible for filtering out already-taken candidates.
 */

const RESERVED_WORDS = [
  'admin', 'root', 'snoospace', 'support', 'help', 'api',
  'moderator', 'mod', 'official', 'staff', 'team', 'bot',
];

/**
 * Sanitize a raw input into a valid username base.
 * Strips everything that isn't [a-z0-9_.] and truncates to 20 chars.
 *
 * @param {string} input
 * @returns {string}
 */
function sanitizeBase(input) {
  return String(input)
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, '')
    .slice(0, 20);
}

/**
 * Generate a list of candidate usernames from a raw base string.
 * Returns an empty array when the base is reserved or too short after sanitization.
 *
 * @param {string} rawBase  - Raw user-supplied string (email local-part, display name, etc.)
 * @returns {string[]}      - Up to 12 candidate usernames, all ≤ 30 chars
 */
function generateCandidates(rawBase) {
  const base = sanitizeBase(rawBase);
  if (!base || base.length < 2 || RESERVED_WORDS.includes(base)) return [];

  const currentYear = new Date().getFullYear();
  const candidates = new Set();

  // Numeric suffixes
  [1, 7, 21, 99, 123].forEach(n => candidates.add(`${base}${n}`));

  // Underscore variants
  candidates.add(`${base}_`);
  candidates.add(`_${base}`);

  // Prefix variants
  candidates.add(`the_${base}`);
  candidates.add(`its_${base}`);

  // Year variants
  candidates.add(`${base}${currentYear}`);
  candidates.add(`${base}.${String(currentYear).slice(-2)}`);

  // Random 3-digit suffix (adds variety on repeated calls)
  candidates.add(`${base}${Math.floor(Math.random() * 900 + 100)}`);

  return Array.from(candidates)
    .filter(c => c.length >= 3 && c.length <= 30)
    .slice(0, 12);
}

module.exports = { generateCandidates, sanitizeBase, RESERVED_WORDS };
