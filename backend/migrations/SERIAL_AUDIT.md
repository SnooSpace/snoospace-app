# SERIAL Overflow Audit — SnooSpace Backend Migrations

**Audit scope:** All `.sql` files in `/backend/migrations/`  
**Audit date:** 2026-05-31  
**Rule:** Flag every table whose primary key is `SERIAL` (32-bit integer, max ~2.1 billion). These are overflow risks at scale.

---

## Summary

| Finding | Count |
|---|---|
| Files audited | 17 `.sql` migration files |
| Tables with `SERIAL` PK → **overflow risk** | **4** |
| Tables with `BIGSERIAL` PK → safe | 25+ |
| Tables with `UUID` PK → safe | 5 |
| Tables skipped (no `id` PK / view / function only) | Several |

---

## Tables Changed

All 4 affected tables are in [`event_engagement.sql`](./event_engagement.sql).  
Fix migration: [`011_fix_serial_overflow.sql`](./011_fix_serial_overflow.sql)

| # | Table | Column | Old Type | New Type | Notes |
|---|---|---|---|---|---|
| 1 | `event_likes` | `id` | `SERIAL` → `integer` | `BIGINT` | High-volume: one row per user per event |
| 2 | `event_views` | `id` | `SERIAL` → `integer` | `BIGINT` | High-volume: one row per user per event (UNIQUE constraint) |
| 3 | `event_comments` | `id` | `SERIAL` → `integer` | `BIGINT` | Also widens `parent_id INTEGER` → `BIGINT` for FK consistency |
| 4 | `event_comment_likes` | `id` | `SERIAL` → `integer` | `BIGINT` | Also widens `comment_id INTEGER` → `BIGINT` for FK consistency |

### Why `event_likes` and `event_views` are high-risk
Both tables have a `UNIQUE(event_id, liker_id/viewer_id, liker_type/viewer_type)` constraint,
meaning each row is unique per user per event — but at platform scale (millions of events × users),
32-bit `SERIAL` overflows at ~2.1 billion rows. `BIGINT` supports up to ~9.2 × 10¹⁸.

---

## Files Confirmed Safe (BIGSERIAL or UUID — not touched)

| File | PK Type |
|---|---|
| `002_chat_enhancements.sql` | `BIGSERIAL` |
| `003_community_auto_join.sql` | No new table PKs |
| `004_conversations_auto_join.sql` | No new table PKs |
| `005_fix_conversation_reports.sql` | `BIGSERIAL` |
| `006_chat_ux_improvements.sql` | No new table PKs |
| `007_group_messaging_restrictions.sql` | No new table PKs |
| `008_group_owner.sql` | No new table PKs |
| `009_denormalized_follow_counts.sql` | No new table PKs |
| `010_open_plans.sql` | `BIGSERIAL` |
| `audience_intelligence.sql` | `BIGSERIAL` throughout |
| `event_quality_scores.sql` | `BIGSERIAL` |
| `privacy_consent.sql` | `BIGSERIAL` |
| `privacy_consent_v2.sql` | No new table PKs (ALTER only) |
| `security_hardening_v1.sql` | `BIGSERIAL` |
| `session_tracking.sql` | `BIGSERIAL` |
| `video_insights.sql` | `UUID` (`gen_random_uuid()`) |

---

## Flagged / Skipped

None. Every table's PK type was unambiguous — no guessing was required.

> **Note:** The `video_insights_cache` table uses `video_id INTEGER PRIMARY KEY` (a FK to `posts.id`, not a sequence). This is not a `SERIAL` column and was **not** altered. If `posts.id` is ever widened, that FK would need a matching update in a separate migration.

---

## How to Apply the Fix

> ⚠️ Review this file before running. Do not apply automatically.

```bash
# Connect to your Supabase/Postgres instance and run:
psql $DATABASE_URL -f backend/migrations/011_fix_serial_overflow.sql
```

The `ALTER COLUMN id TYPE BIGINT` operation on an integer column is a **metadata-only change** in PostgreSQL — it does not rewrite the table or lock it for extended periods on modern PG versions (12+).

---

## What Was NOT Changed

- No application logic, API routes, ORM models, or non-migration files were touched.
- The underlying sequences (used by `SERIAL`) were not modified — sequences are already 64-bit in PostgreSQL by default.
- Foreign key columns referencing these tables from *other* tables (e.g., `event_id INTEGER` in engagement tables) were **not** widened — those reference `events.id` which is a separate concern.
