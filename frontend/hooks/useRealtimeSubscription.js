import { useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';

/**
 * Custom hook to subscribe to a Supabase Realtime channel.
 * Uses a ref for the onData callback to avoid re-triggering the subscription effect.
 *
 * @param {Object} params
 * @param {string} params.table - Database table name (e.g. 'notifications')
 * @param {string} params.event - Event to subscribe to ('INSERT', 'UPDATE', 'DELETE', or '*')
 * @param {string} params.filter - Postgres change filter (e.g. 'user_id=eq.123')
 * @param {Function} params.onData - Callback when data change event occurs
 */
export default function useRealtimeSubscription({ table, event = '*', filter, onData }) {
  const onDataRef = useRef(onData);

  // Synchronously update the callback reference on every render
  useEffect(() => {
    onDataRef.current = onData;
  }, [onData]);

  useEffect(() => {
    if (!supabase) {
      console.warn("[Realtime] Supabase client not initialized, skipping subscription.");
      return;
    }

    // Sanitize filter to generate a safe unique channel name
    const sanitizedFilter = filter ? filter.replace(/[^a-zA-Z0-9]/g, '_') : 'all';
    const channelName = `${table}_${sanitizedFilter}`;
    let channel;

    try {
      console.log(`[Realtime] Initializing subscription to ${table} for event=${event}, filter=${filter || 'none'}`);
      channel = supabase.channel(channelName)
        .on(
          'postgres_changes',
          {
            event,
            schema: 'public',
            table,
            filter,
          },
          (payload) => {
            if (onDataRef.current) {
              onDataRef.current(payload);
            }
          }
        );

      channel.subscribe((status, err) => {
        if (err) {
          console.error(`[Realtime] Subscription error on channel '${channelName}':`, err);
        } else {
          console.log(`[Realtime] Channel '${channelName}' subscription status:`, status);
        }
      });
    } catch (err) {
      console.error(`[Realtime] Failed to create or subscribe channel '${channelName}':`, err);
    }

    // Cleanup: remove the channel subscription when the component unmounts or dependencies change
    return () => {
      if (channel) {
        console.log(`[Realtime] Cleaning up subscription for channel '${channelName}'`);
        supabase.removeChannel(channel)
          .catch((err) => console.warn(`[Realtime] Error removing channel '${channelName}':`, err));
      }
    };
  }, [table, event, filter]); // Exclude onData to prevent infinite loop
}
