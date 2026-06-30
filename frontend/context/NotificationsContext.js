import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { fetchNotifications, fetchUnreadCount, markAllNotificationsRead } from '../api/notifications';
import { getSocket } from '../services/socketService';

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [currentBanner, setCurrentBanner] = useState(null);
  const offsetRef = useRef(0);
  const debounceRef = useRef(null);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const [{ unread: c }, list] = await Promise.all([
        fetchUnreadCount(),
        fetchNotifications({ limit: 20, offset: 0 })
      ]);
      setUnread(c || 0);
      setItems(list?.notifications || []);
      offsetRef.current = list?.nextOffset || 0;
    } catch {
      // no-op
    } finally {
      setLoading(false);
    }
  }, []);

  // Listen for real-time notification events via Socket.io.
  // The backend emits 'new_notification' to user_${id} room on every notification insert.
  // This replaces the broken Supabase Realtime RLS-filtered subscription.
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

    return () => {
      socket.off('new_notification', handleNewNotification);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [loadInitial]);

  const loadMore = useCallback(async () => {
    try {
      const list = await fetchNotifications({ limit: 20, offset: offsetRef.current });
      setItems(prev => [...prev, ...(list?.notifications || [])]);
      offsetRef.current = list?.nextOffset || offsetRef.current;
    } catch {}
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      setUnread(0);
      setItems(prev => prev.map(n => ({ ...n, is_read: true })));
      await markAllNotificationsRead();
    } catch {}
  }, []);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  const value = useMemo(
    () => ({ items, unread, loading, loadInitial, loadMore, markAllRead, currentBanner, setCurrentBanner }),
    [items, unread, loading, loadInitial, loadMore, markAllRead, currentBanner]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  return useContext(NotificationsContext) || {
    items: [],
    unread: 0,
    loading: false,
    loadInitial: () => {},
    loadMore: () => {},
    markAllRead: () => {},
  };
}
