import * as Location from 'expo-location';
import { AppState } from 'react-native';
import { updateLocation } from '../api/members';

let subscriber = null;
let lastSyncedAt = 0;
let lastSentCoords = null;
const MIN_SYNC_MS = 2 * 60 * 1000; // 2 minutes debounce
const SIGNIFICANT_METERS = 250; // 250m
const FALLBACK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
let fallbackTimer = null;

function distanceMeters(a, b) {
  if (!a || !b) return Infinity;
  const toRad = d => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function maybeSync(coords) {
  const now = Date.now();
  if (now - lastSyncedAt < MIN_SYNC_MS) return;
  const moved = distanceMeters(lastSentCoords, coords);
  if (moved < SIGNIFICANT_METERS && now - lastSyncedAt < FALLBACK_INTERVAL_MS) return;

  lastSyncedAt = now;
  lastSentCoords = coords;
  try {
    await updateLocation({ lat: coords.latitude, lng: coords.longitude });
  } catch {
    // best-effort; ignore errors
  }
}

export async function startForegroundWatch() {
  try {
    console.log('[LocationTracker] startForegroundWatch called');
    
    // Check if we already have permission before requesting
    let { status } = await Location.getForegroundPermissionsAsync();
    console.log('[LocationTracker] Current permission status:', status);
    
    // Only request if we don't have permission yet
    if (status !== 'granted') {
      console.log('[LocationTracker] Requesting location permission...');
      const result = await Location.requestForegroundPermissionsAsync();
      status = result.status;
      console.log('[LocationTracker] Permission request result:', status);
    } else {
      console.log('[LocationTracker] Permission already granted, skipping request');
    }
    
    if (status !== 'granted') {
      console.log('[LocationTracker] Permission not granted, aborting tracking');
      return false;
    }

    // Clear previous
    stopForegroundWatch();

    // Start watch
    subscriber = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 30000,
        distanceInterval: 50,
      },
      (pos) => {
        const coords = pos?.coords;
        if (coords?.latitude && coords?.longitude) {
          maybeSync(coords);
        }
      }
    );

    // Fallback periodic sync
    fallbackTimer = setInterval(async () => {
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const coords = loc?.coords;
        if (coords?.latitude && coords?.longitude) {
          maybeSync(coords);
        }
      } catch {}
    }, FALLBACK_INTERVAL_MS);

    return true;
  } catch {
    return false;
  }
}

export function stopForegroundWatch() {
  if (subscriber) {
    try { subscriber.remove(); } catch {}
    subscriber = null;
  }
  if (fallbackTimer) {
    clearInterval(fallbackTimer);
    fallbackTimer = null;
  }
}

export function attachAppStateListener() {
  const handler = (state) => {
    if (state === 'active') {
      startForegroundWatch();
    } else {
      stopForegroundWatch();
    }
  };
  const sub = AppState.addEventListener('change', handler);
  return () => sub.remove();
}


