import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { fetchNotifications, fetchUnreadCount, markAllNotificationsRead } from '../api/notifications';
import { getAuthToken } from '../api/auth';
import { BACKEND_BASE_URL } from '../api/client';

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [currentBanner, setCurrentBanner] = useState(null);
  const offsetRef = useRef(0);
  const subRef = useRef(null);
  const userRef = useRef({ id: null, type: 'member' });

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

  // Optional realtime: dynamically import Supabase only if available
  const supabaseRef = useRef(null);
  const [realtimeReady, setRealtimeReady] = useState(false);

  useEffect(() => {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return; // No envs → skip
    (async () => {
      try {
        const mod = await import('@supabase/supabase-js');
        if (mod && mod.createClient) {
          supabaseRef.current = mod.createClient(url, key);
          setRealtimeReady(true);
        }
      } catch {
        // Module not installed; skip realtime
      }
    })();
  }, []);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    const supabase = supabaseRef.current;
    if (!realtimeReady || !supabase) return;
    let channel;
    (async () => {
      try {
        // We rely on RLS or server-side if present; otherwise client-side filter is fine
        // Since we don't have user id here from a central auth store, we subscribe broadly and filter
        channel = supabase.channel('notifications_inserts')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
            const row = payload?.new;
            if (!row) return;
            // Client-side filter: recipient only
            if (userRef.current.id && row.recipient_id !== userRef.current.id) return;
            setItems(prev => [row, ...prev]);
            setUnread(prev => prev + 1);
            // Show banner for new notification
            setCurrentBanner(row);
          })
          .subscribe();
      } catch {}
    })();
    return () => {
      try { channel && supabase.removeChannel(channel); } catch {}
    };
  }, [realtimeReady]);

  // Fallback: lightweight polling to keep unread badge fresh if realtime is unavailable
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const r = await fetchUnreadCount();
        if (typeof r?.unread === 'number') setUnread(r.unread);
      } catch {}
    }, 30000);
    return () => clearInterval(id);
  }, []);

  const value = useMemo(() => ({ items, unread, loading, loadInitial, loadMore, markAllRead, currentBanner, setCurrentBanner }), [items, unread, loading, loadInitial, loadMore, markAllRead, currentBanner]);
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  return useContext(NotificationsContext) || { items: [], unread: 0, loading: false, loadInitial: () => {}, loadMore: () => {}, markAllRead: () => {} };
}


