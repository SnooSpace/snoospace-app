import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { fetchNotifications, fetchUnreadCount, markAllNotificationsRead } from '../api/notifications';
import { getAuthToken, getActiveAccount } from '../api/auth';
import { BACKEND_BASE_URL } from '../api/client';
import useRealtimeSubscription from '../hooks/useRealtimeSubscription';

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [currentBanner, setCurrentBanner] = useState(null);
  const offsetRef = useRef(0);
  const userRef = useRef({ id: null, type: 'member' });
  const [currentUserId, setCurrentUserId] = useState(null);

  // Load active account details on mount/session check
  useEffect(() => {
    const loadUser = async () => {
      try {
        const activeAccount = await getActiveAccount();
        if (activeAccount?.id) {
          setCurrentUserId(activeAccount.id);
          userRef.current = { id: activeAccount.id, type: activeAccount.type || 'member' };
        }
      } catch (err) {
        console.warn("[NotificationsContext] Error loading active account:", err);
      }
    };
    loadUser();
  }, []);

  // Subscribe to real-time notification events
  useRealtimeSubscription({
    table: 'notifications',
    event: '*',
    filter: currentUserId ? `recipient_id=eq.${currentUserId}` : null,
    onData: (payload) => {
      if (payload.eventType === 'INSERT') {
        const row = payload.new;
        if (!row) return;
        console.log("[NotificationsContext] New notification received via Realtime:", row);
        setItems(prev => [row, ...prev]);
        setUnread(prev => prev + 1);
        setCurrentBanner(row);
      } else if (payload.eventType === 'UPDATE') {
        const row = payload.new;
        if (!row) return;
        console.log("[NotificationsContext] Notification updated via Realtime:", row);
        setItems(prev => prev.map(n => n.id === row.id ? row : n));
        
        // If marked read, refresh the unread count from database
        if (row.is_read) {
          fetchUnreadCount().then(r => {
            if (typeof r?.unread === 'number') setUnread(r.unread);
          }).catch(err => console.warn("[NotificationsContext] Error refreshing unread count:", err));
        }
      }
    }
  });

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

  const value = useMemo(() => ({ items, unread, loading, loadInitial, loadMore, markAllRead, currentBanner, setCurrentBanner }), [items, unread, loading, loadInitial, loadMore, markAllRead, currentBanner]);
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  return useContext(NotificationsContext) || { items: [], unread: 0, loading: false, loadInitial: () => {}, loadMore: () => {}, markAllRead: () => {} };
}


