import * as Notifications from 'expo-notifications';
import { apiPatch } from '../api/client';
import { getAuthToken, getActiveAccount } from '../api/auth';
import EventBus from '../utils/EventBus';

// Session cache to prevent duplicate reads for the same reference
const consumedReferences = new Set();
let currentSessionUserKey = null;

/**
 * Reusable helper to dismiss presented notifications matching a custom predicate.
 */
async function dismissMatchingNotifications(predicate) {
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    console.log(`[NotificationConsumption] Current presented notifications count in tray: ${presented.length}`);
    presented.forEach((n, idx) => {
      console.log(`[NotificationConsumption] Presented[${idx}] identifier: ${n.request.identifier}`);
      console.log(`[NotificationConsumption] Presented[${idx}] trigger:`, JSON.stringify(n.request.trigger));
      console.log(`[NotificationConsumption] Presented[${idx}] content:`, JSON.stringify(n.request.content));
    });

    const toDismiss = presented.filter(predicate);
    console.log(`[NotificationConsumption] Matching notifications to dismiss count: ${toDismiss.length}`);
    
    if (toDismiss.length > 0) {
      const promises = toDismiss.map(n => {
        console.log(`[NotificationConsumption] Dismissing tray notification: ${n.request.identifier}`);
        return Notifications.dismissNotificationAsync(n.request.identifier);
      });
      await Promise.all(promises);
      console.log(`[NotificationConsumption] Successfully dismissed ${promises.length} notifications from tray`);
    }
  } catch (err) {
    console.warn('[NotificationConsumption] Failed to dismiss matching notifications:', err);
  }
}

async function markBackendRead(referenceType, referenceId) {
  try {
    console.log(`[NotificationConsumption] markBackendRead called for type: ${referenceType}, id: ${referenceId}`);
    const token = await getAuthToken();
    if (!token) {
      console.warn('[NotificationConsumption] No auth token found, skipping backend update.');
      return false;
    }

    // Detect user/auth session change or account switch and clear cache
    const activeAccount = await getActiveAccount();
    const activeUserKey = activeAccount ? `${activeAccount.type}:${activeAccount.id}` : null;
    
    if (activeUserKey !== currentSessionUserKey) {
      console.log(`[NotificationConsumption] Session changed from ${currentSessionUserKey} to ${activeUserKey}. Clearing cache.`);
      consumedReferences.clear();
      currentSessionUserKey = activeUserKey;
    }

    const cacheKey = `${referenceType}:${referenceId}`;
    if (consumedReferences.has(cacheKey)) {
      console.log(`[NotificationConsumption] Reference ${cacheKey} already marked read this session (cached).`);
      return true; 
    }
    
    console.log(`[NotificationConsumption] Sending PATCH request to mark ${referenceType}:${referenceId} read on backend...`);
    const response = await apiPatch(
      `/notifications/read`,
      { referenceType, referenceId },
      15000,
      token
    );

    console.log('[NotificationConsumption] Backend PATCH response:', JSON.stringify(response));

    if (response?.success) {
      consumedReferences.add(cacheKey);
      return true;
    }
    return false;
  } catch (err) {
    console.error(`[NotificationConsumption] Failed to mark ${referenceType} backend read:`, err);
    return false;
  }
}

/**
 * Generic consume coordinator.
 * Marks DB notifications read (if referenceType is supplied), clears OS tray, and emits context updates.
 */
async function consume({ referenceType, referenceId, predicate }) {
  console.log(`[NotificationConsumption] Starting consumption for referenceType: ${referenceType || 'chat'}, id: ${referenceId}`);
  if (referenceType) {
    const success = await markBackendRead(referenceType, referenceId);
    console.log(`[NotificationConsumption] markBackendRead status: ${success}`);
    if (!success) {
      console.log('[NotificationConsumption] markBackendRead was unsuccessful, aborting tray dismissal.');
      return;
    }
  }
  await dismissMatchingNotifications(predicate);
  console.log('[NotificationConsumption] Emitting notifications-read event...');
  EventBus.emit("notifications-read");
}

export const NotificationConsumptionService = {
  /**
   * Consume chat notifications (tray-only).
   */
  async consumeChat(chatId) {
    if (!chatId) return;
    console.log(`[NotificationConsumption] consumeChat triggered for chatId: ${chatId}`);
    await consume({
      referenceId: chatId,
      predicate: notif => {
        const title = notif.request.content.title || "";
        const data = notif.request.content.data;
        
        // 1. Match using payload data if available
        if (data && Object.keys(data).length > 0) {
          const match = !!(
            data.chatId === String(chatId) || 
            data.chatId === Number(chatId) ||
            (data.screen === "Chat" && data.chatId === String(chatId))
          );
          console.log(`[NotificationConsumption] Chat data match check: ${match}`);
          return match;
        }
        
        // 2. Fallback: match by title text/structure if data is missing (Android background launch bug)
        // Chat notifications are typically sender names or group names without the standard action emojis.
        const isOther = (
          title.includes("💬") || 
          title.includes("❤️") || 
          title.includes("🏷️") || 
          title.includes("👤") || 
          title.includes("🎟️") || 
          title.includes("📅") || 
          title.includes("❌") ||
          title.includes("Follow") ||
          title.includes("Comment") ||
          title.includes("Like")
        );
        const matchFallback = !isOther;
        console.log(`[NotificationConsumption] Chat fallback match check (isOther: ${isOther}): ${matchFallback}`);
        return matchFallback;
      }
    });
  },

  /**
   * Consume event notifications (backend + tray).
   */
  async consumeEvent(eventId) {
    if (!eventId) return;
    console.log(`[NotificationConsumption] consumeEvent triggered for eventId: ${eventId}`);
    await consume({
      referenceType: "event",
      referenceId: eventId,
      predicate: notif => {
        const title = notif.request.content.title || "";
        const data = notif.request.content.data;
        
        // 1. Match using payload data if available
        if (data && Object.keys(data).length > 0) {
          const match = !!(
            data.eventId === String(eventId) || 
            data.eventId === Number(eventId) ||
            data.event_id === String(eventId) || 
            data.event_id === Number(eventId) ||
            (data.type && data.type.startsWith("event") && (data.eventId === String(eventId) || data.eventId === Number(eventId)))
          );
          console.log(`[NotificationConsumption] Event data match check: ${match}`);
          return match;
        }
        
        // 2. Fallback: match by title text if data payload is missing (Android background launch bug)
        const lowerTitle = title.toLowerCase();
        const matchFallback = (
          lowerTitle.includes("event") || 
          lowerTitle.includes("registration") || 
          lowerTitle.includes("invite") ||
          title.includes("🎟️") || 
          title.includes("📅")
        );
        console.log(`[NotificationConsumption] Event fallback match check: ${matchFallback}`);
        return matchFallback;
      }
    });
  },

  /**
   * Consume post notifications (likes/comments/tags).
   */
  async consumePost(postId, baseRoute = "/posts") {
    if (!postId) return;
    console.log(`[NotificationConsumption] consumePost triggered for postId: ${postId}, baseRoute: ${baseRoute}`);
    const referenceType = baseRoute.includes("event") ? "event" : "post";
    await consume({
      referenceType,
      referenceId: postId,
      predicate: notif => {
        const title = notif.request.content.title || "";
        const data = notif.request.content.data;
        
        // 1. Match using payload data if available
        if (data && Object.keys(data).length > 0) {
          const match = !!(
            data.postId === String(postId) || 
            data.postId === Number(postId) ||
            data.post_id === String(postId) || 
            data.post_id === Number(postId) ||
            ((data.type === "comment" || data.type === "like" || data.type === "tag") && (data.postId === String(postId) || data.postId === Number(postId)))
          );
          console.log(`[NotificationConsumption] Post data match check: ${match}`);
          return match;
        }
        
        // 2. Fallback: match by title text if data payload is missing (Android background launch bug)
        const matchFallback = (
          title.includes("Comment") || 
          title.includes("Like") || 
          title.includes("Tag") || 
          title.includes("💬") || 
          title.includes("❤️") || 
          title.includes("🏷️")
        );
        console.log(`[NotificationConsumption] Post fallback match check: ${matchFallback}`);
        return matchFallback;
      }
    });
  },

  /**
   * Consume follow notifications (backend + tray).
   */
  async consumeFollow(actorId) {
    if (!actorId) return;
    console.log(`[NotificationConsumption] consumeFollow triggered for actorId: ${actorId}`);
    await consume({
      referenceType: "follow",
      referenceId: actorId,
      predicate: notif => {
        const title = notif.request.content.title || "";
        const data = notif.request.content.data;
        
        // 1. Match using payload data if available
        if (data && Object.keys(data).length > 0) {
          const match = !!(
            data.actorId === String(actorId) || 
            data.actorId === Number(actorId) ||
            ((data.type === "follow" || data.type === "creator_follow_received") && (data.actorId === String(actorId) || data.actorId === Number(actorId)))
          );
          console.log(`[NotificationConsumption] Follow data match check: ${match}`);
          return match;
        }
        
        // 2. Fallback: match by title text if data payload is missing (Android background launch bug)
        const matchFallback = (
          title.includes("Follow") || 
          title.includes("👤")
        );
        console.log(`[NotificationConsumption] Follow fallback match check: ${matchFallback}`);
        return matchFallback;
      }
    });
  }
};
