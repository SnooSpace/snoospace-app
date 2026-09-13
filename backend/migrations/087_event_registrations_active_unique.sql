-- Migration 087: Enforce at database-level that a member can have at most one non-cancelled registration per event
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_registrations_active_unique
ON event_registrations (event_id, member_id)
WHERE registration_status != 'cancelled';
