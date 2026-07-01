let cachedRecipients = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60000; // 60-second TTL

export const getCachedRecipients = () => {
  if (cachedRecipients && (Date.now() - cacheTimestamp < CACHE_TTL_MS)) {
    return cachedRecipients;
  }
  return null;
};

export const setCachedRecipients = (recipients) => {
  cachedRecipients = recipients;
  cacheTimestamp = Date.now();
};

export const getCacheAgeSeconds = () => {
  if (!cacheTimestamp) return 0;
  return Math.round((Date.now() - cacheTimestamp) / 1000);
};

export const invalidateCache = () => {
  cachedRecipients = null;
  cacheTimestamp = 0;
};
