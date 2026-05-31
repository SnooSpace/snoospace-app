# UUID v7 Upgrade — SnooSpace Backend Migrations

**Upgrade scope:** All tables with `UUID PRIMARY KEY DEFAULT gen_random_uuid()`  
**Audit date:** 2026-05-31  
**Status:** Pre-launch — no external systems have stored these IDs

---

## Why UUID v7

UUID v4 is purely random. When used as a B-tree index key, every new insert lands at a random position in the index, causing frequent page splits and fragmentation over time. UUID v7 prefixes the UUID with a 48-bit millisecond timestamp, making new rows insert monotonically at the end of the index — the same efficient pattern as `BIGSERIAL`.

The column type remains `UUID` throughout. This is a **default expression swap only** — no data is rewritten, no types change, no FK constraints are affected.

---

## Migration Files

Run in this exact order:

| Order | File | Purpose |
|---|---|---|
| 1st | [`012_uuid_v7_function.sql`](./012_uuid_v7_function.sql) | Installs `uuid_generate_v7()` function |
| 2nd | [`013_uuid_v7_defaults.sql`](./013_uuid_v7_defaults.sql) | Swaps column defaults on all affected tables |

> **If 012 fails**: Do not run 013. The function must exist before the defaults reference it.  
> **If 013 fails**: The entire block rolls back via `BEGIN/COMMIT`. The function installed by 012 remains but no defaults are changed — safe state.

---

## Tables Changed

### From `migrations/video_insights.sql`

| # | Table | Column | Old Default | New Default |
|---|---|---|---|---|
| 1 | `video_watch_events` | `id` | `gen_random_uuid()` | `uuid_generate_v7()` |
| 2 | `video_follow_conversions` | `id` | `gen_random_uuid()` | `uuid_generate_v7()` |

> `video_insights_cache` was **not altered** — its PK is `video_id INTEGER` (a FK to `posts.id`), not a UUID sequence.

---

### From `scripts/opportunities_migration.sql`

| # | Table | Column | Old Default | New Default |
|---|---|---|---|---|
| 3 | `opportunities` | `id` | `gen_random_uuid()` | `uuid_generate_v7()` |
| 4 | `opportunity_skill_groups` | `id` | `gen_random_uuid()` | `uuid_generate_v7()` |
| 5 | `opportunity_questions` | `id` | `gen_random_uuid()` | `uuid_generate_v7()` |
| 6 | `opportunity_applications` | `id` | `gen_random_uuid()` | `uuid_generate_v7()` |
| 7 | `opportunity_application_responses` | `id` | `gen_random_uuid()` | `uuid_generate_v7()` |

---

### From `scripts/community_restructure_migration.sql`

| # | Table | Column | Old Default | New Default |
|---|---|---|---|---|
| 8 | `colleges` | `id` | `gen_random_uuid()` | `uuid_generate_v7()` |

---

### From `scripts/migrate_otp_auth.sql`

| # | Table | Column | Old Default | New Default |
|---|---|---|---|---|
| 9 | `sessions` | `id` | `gen_random_uuid()` | `uuid_generate_v7()` |

---

### From `scripts/profile_view_tracking.sql`

| # | Table | Column | Old Default | New Default |
|---|---|---|---|---|
| 10 | `profile_views` | `id` | `gen_random_uuid()` | `uuid_generate_v7()` |
| 11 | `connection_requests` | `id` | `gen_random_uuid()` | `uuid_generate_v7()` |

---

### From `db.js` (inline schema bootstrap)

| # | Table | Column | Old Default | New Default | Note |
|---|---|---|---|---|---|
| 12 | `campuses` | `id` | `gen_random_uuid()` | `uuid_generate_v7()` | Defined in app code, not a SQL file — this ALTER brings it into migration history |

---

## Existing Row Data

**Not modified.** `ALTER TABLE ... ALTER COLUMN id SET DEFAULT` changes only what value is generated for future inserts. All existing rows retain their original UUID v4 values. This is expected and safe — UUID v4 and v7 are both valid UUIDs and coexist in the same column without issue.

---

## Pre-Flight Check

Run this before applying 013 — must return **0 rows**:

```sql
SELECT viewname, definition FROM pg_views
WHERE definition ILIKE '%video_watch_events%'
   OR definition ILIKE '%video_follow_conversions%'
   OR definition ILIKE '%opportunities%'
   OR definition ILIKE '%opportunity_skill_groups%'
   OR definition ILIKE '%opportunity_questions%'
   OR definition ILIKE '%opportunity_applications%'
   OR definition ILIKE '%opportunity_application_responses%'
   OR definition ILIKE '%colleges%'
   OR definition ILIKE '%sessions%'
   OR definition ILIKE '%profile_views%'
   OR definition ILIKE '%connection_requests%'
   OR definition ILIKE '%campuses%';
```

---

## Verify After Running

After both migrations succeed, confirm the defaults are applied:

```sql
SELECT table_name, column_name, column_default
FROM information_schema.columns
WHERE column_name = 'id'
  AND column_default LIKE '%uuid_generate_v7%'
ORDER BY table_name;
```

Expected: **12 rows** returned, one per table above.

---

## Flags / Additional Notes

> **`branches` table** (`community_restructure_migration.sql`, line 26): uses `SERIAL PRIMARY KEY` (32-bit integer). This is an overflow risk unrelated to UUID. It was **not altered here** — addressed in [`014_fix_branches_serial.sql`](./014_fix_branches_serial.sql). See that file for details.

> **`campuses` table**: defined in `db.js` (inline schema bootstrap), not in any `.sql` migration file. Its UUID default has been added as statement 12 in `013_uuid_v7_defaults.sql` (quick fix). The broader problem — campuses being outside migration history entirely — is flagged as tech debt to address before launch in a dedicated session.

---

## Rollback

To revert the defaults if needed (run after 013, before any new rows are inserted):

```sql
BEGIN;
ALTER TABLE video_watch_events          ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE video_follow_conversions    ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE opportunities               ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE opportunity_skill_groups    ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE opportunity_questions       ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE opportunity_applications    ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE opportunity_application_responses ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE colleges                    ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE sessions                    ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE profile_views               ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE connection_requests         ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE campuses                    ALTER COLUMN id SET DEFAULT gen_random_uuid();
COMMIT;
```
