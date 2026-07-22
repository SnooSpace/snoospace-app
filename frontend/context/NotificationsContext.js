import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { fetchNotifications, fetchUnreadCount, markAllNotificationsRead } from '../api/notifications';
import { getSocket } from '../services/socketService';
import EventBus from '../utils/EventBus';

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [categoryBreakdown, setCategoryBreakdown] = useState({
    activity: 0,
    communities: 0,
    messages: 0,
    events: 0,
    system: 0
  });
  const [loading, setLoading] = useState(false);
  const [currentBanner, setCurrentBanner] = useState(null);
  const offsetRef = useRef(0);
  const debounceRef = useRef(null);

  const loadInitial = useCallback(async (options = {}) => {
    const isBackground = options?.background === true;
    if (!isBackground) setLoading(true);
    try {
      const [unreadRes, list] = await Promise.all([
        fetchUnreadCount(),
        fetchNotifications({ limit: 20, offset: 0, category: 'all' })
      ]);
      setUnread(unreadRes?.unread || 0);
      setCategoryBreakdown(unreadRes?.breakdown || {
        activity: 0,
        communities: 0,
        messages: 0,
        events: 0,
        system: 0
      });
      setItems(list?.notifications || []);
      offsetRef.current = list?.nextOffset || 0;
    } catch {
      // no-op
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, []);

  // Listen for real-time notification events via Socket.io and local consumption events.
  useEffect(() => {
    const socket = getSocket();

    const handleNewNotification = () => {
      // Debounce to coalesce rapid back-to-back events (e.g. bulk likes)
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        loadInitial();
      }, 300);
    };

    socket.on('new_notification', handleNewNotification);

    // When the socket drops and reconnects (background drop, server restart, etc.)
    // reload notifications to recover any events missed during the gap.
    const unsubReconnect = EventBus.on('socket:reconnected', () => {
      console.log('[Notifications] socket:reconnected — reloading to catch missed events');
      loadInitial();
    });

    const unsubConsumed = EventBus.on('notifications-read', () => {
      loadInitial();
    });

    return () => {
      socket.off('new_notification', handleNewNotification);
      unsubReconnect();
      unsubConsumed();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [loadInitial]);

  // Keep OS badge count in sync with local unread context count
  useEffect(() => {
    Notifications.setBadgeCountAsync(unread).catch(() => {});
  }, [unread]);

  const loadMore = useCallback(async () => {
    try {
      const list = await fetchNotifications({ limit: 20, offset: offsetRef.current, category: 'all' });
      setItems(prev => [...prev, ...(list?.notifications || [])]);
      offsetRef.current = list?.nextOffset || offsetRef.current;
    } catch {}
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      setUnread(0);
      setCategoryBreakdown({
        activity: 0,
        communities: 0,
        messages: 0,
        events: 0,
        system: 0
      });
      setItems(prev => prev.map(n => ({ ...n, is_read: true })));
      await markAllNotificationsRead();
    } catch {}
  }, []);

  const loadUnreadCountOnly = useCallback(async () => {
    try {
      const unreadRes = await fetchUnreadCount();
      setUnread(unreadRes?.unread || 0);
      setCategoryBreakdown(unreadRes?.breakdown || {
        activity: 0,
        communities: 0,
        messages: 0,
        events: 0,
        system: 0
      });
    } catch {
      // no-op
    }
  }, []);

  useEffect(() => {
    loadUnreadCountOnly();
  }, [loadUnreadCountOnly]);

  const value = useMemo(
    () => ({ items, unread, categoryBreakdown, loading, loadInitial, loadMore, markAllRead, currentBanner, setCurrentBanner, loadUnreadCountOnly }),
    [items, unread, categoryBreakdown, loading, loadInitial, loadMore, markAllRead, currentBanner, loadUnreadCountOnly]
  );

  // [DIAG-CTX-IDENTITY] — remove after isolation sprint
  // Tracks whether useMemo produced the SAME value object reference across renders.
  // sameRefAsPrevious=true  → memoization held, no downstream re-renders triggered by this context
  // sameRefAsPrevious=false → new object created; all consumers will re-render
  const prevValueRef = useRef(null);
  const isSameReference = prevValueRef.current === value;
  // Assign synchronously in render body so the next render sees the current reference
  prevValueRef.current = value;

  useEffect(() => {
    // [DIAG-CTX-IDENTITY] — remove after isolation sprint
    console.log(`[DIAG-CTX-IDENTITY] NotificationsContext: sameRefAsPrevious=${isSameReference}, unread=${unread}, items=${items?.length ?? 0} at t=${Date.now()}`);
  }, [value]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  return useContext(NotificationsContext) || {
    items: [],
    unread: 0,
    categoryBreakdown: {
      activity: 0,
      communities: 0,
      messages: 0,
      events: 0,
      system: 0
    },
    loading: false,
    loadInitial: () => {},
    loadMore: () => {},
    markAllRead: () => {},
    loadUnreadCountOnly: () => {},
  };
}
