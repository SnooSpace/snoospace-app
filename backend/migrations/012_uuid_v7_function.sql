-- ============================================================
-- 012_uuid_v7_function.sql
-- Installs a UUID v7 generator function for use as column defaults.
--
-- UUID v7 is time-ordered (48-bit millisecond timestamp prefix),
-- which means new rows insert at the end of B-tree indexes instead
-- of at random positions (UUID v4 behaviour). This reduces index
-- page splits and fragmentation significantly at scale.
--
-- Version strategy:
--   - hex_ms   : 48-bit Unix timestamp in milliseconds (12 hex chars)
--   - rand_a   : 12 random bits (version nibble '7' + 3 hex chars)
--   - rand_b   : 64 random bits (variant bits set per RFC 9562)
--
-- Dependencies: pgcrypto (gen_random_bytes) — available on all
--   standard PostgreSQL installs including Supabase and RDS.
--
-- Run this BEFORE 013_uuid_v7_defaults.sql.
-- Idempotent: CREATE OR REPLACE means it is safe to run again.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION uuid_generate_v7()
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  unix_ms  BIGINT;
  hex_ms   TEXT;
  rand_a   TEXT;
  rand_b   TEXT;
BEGIN
  unix_ms := EXTRACT(EPOCH FROM clock_timestamp())::BIGINT * 1000
             + (EXTRACT(MILLISECONDS FROM clock_timestamp())::INTEGER % 1000);
  hex_ms  := LPAD(TO_HEX(unix_ms), 12, '0');
  rand_a  := LPAD(TO_HEX((gen_random_bytes(2)::TEXT::BIT(16))::INTEGER), 3, '0');
  rand_b  := ENCODE(gen_random_bytes(8), 'hex');
  RETURN (
    SUBSTRING(hex_ms, 1, 8)  || '-' ||
    SUBSTRING(hex_ms, 9, 4)  || '-' ||
    '7' || SUBSTRING(rand_a, 1, 3) || '-' ||
    TO_HEX(((('x' || SUBSTRING(rand_b, 1, 2))::BIT(8)::INTEGER & 63) | 128)) ||
    SUBSTRING(rand_b, 3, 2)  || '-' ||
    SUBSTRING(rand_b, 5, 12)
  )::UUID;
END;
$$;

COMMIT;
