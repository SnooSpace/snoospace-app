# Database Cleanup Scripts

## Overview

This directory contains SQL scripts to clean up duplicate conversations in the database.

## Scripts

### 1. `cleanup_duplicates_safe.sql` (RECOMMENDED)

Step-by-step script with verification at each stage. Run each section separately.

### 2. `cleanup_duplicate_conversations.sql`

All-in-one script that performs the cleanup in a single transaction.

---

## How to Run (Step-by-Step Method - RECOMMENDED)

### Prerequisites

- Access to your PostgreSQL database
- pgAdmin, psql, or any PostgreSQL client

### Instructions

1. **Connect to your database**:

   ```bash
   psql -U your_username -d your_database_name
   ```

2. **Run STEP 1 (Identify Duplicates)**:
   - Copy and paste STEP 1 from `cleanup_duplicates_safe.sql`
   - Review the output to see how many duplicates exist
   - Make note of the conversation IDs that will be kept vs deleted

3. **Run STEP 2 (Check Messages)**:
   - Copy and paste STEP 2 from `cleanup_duplicates_safe.sql`
   - Review how many messages are in duplicate conversations
   - All messages will be preserved and migrated

4. **Run STEP 3 (Perform Cleanup)**:
   - Copy and paste the entire STEP 3 block from `cleanup_duplicates_safe.sql`
   - This starts a transaction with `BEGIN;`
   - **IMPORTANT**: The script will pause before committing
   - Review the summary output carefully

5. **Commit or Rollback**:
   - If the summary looks correct, run: `COMMIT;`
   - If something looks wrong, run: `ROLLBACK;` to undo changes

6. **Run STEP 4 (Verification)**:
   - After committing, run the verification queries
   - Should show 0 duplicates remaining
   - Should show 0 orphaned messages

---

## What the Script Does

1. **Identifies duplicate conversations**: Finds all conversation pairs with the same participants
2. **Keeps the oldest**: For each duplicate group, keeps the conversation with the lowest ID
3. **Migrates messages**: Moves all messages from duplicate conversations to the kept one
4. **Updates timestamps**: Sets `last_message_at` to the most recent message
5. **Deletes duplicates**: Removes the duplicate conversation records

---

## Safety Features

- ✅ Uses transactions (can rollback if needed)
- ✅ Preserves all messages (nothing is deleted)
- ✅ Keeps the oldest conversation for continuity
- ✅ Provides verification queries
- ✅ Shows before/after statistics

---

## Example Output

```
 duplicate_groups_cleaned | conversations_deleted | unique_conversations_with_messages
--------------------------+-----------------------+------------------------------------
                        5 |                    12 |                                543
```

This shows:

- 5 groups of duplicates were found
- 12 duplicate conversations were removed
- 543 unique conversations remain with messages

---

## Troubleshooting

**Q: What if I ran the script by accident?**  
A: If you haven't committed yet, run `ROLLBACK;` immediately.

**Q: Can I test this on a copy first?**  
A: Yes! Create a database backup first:

```bash
pg_dump -U your_username your_database_name > backup.sql
```

**Q: What if verification shows orphaned messages?**  
A: This shouldn't happen with the script. If it does, run `ROLLBACK;` and report the issue.

**Q: Will this affect ongoing user sessions?**  
A: The cleanup runs quickly and is atomic. Consider running during low-traffic hours.

---

## Running the All-in-One Script (Alternative)

If you prefer to run everything at once:

```bash
psql -U your_username -d your_database_name -f cleanup_duplicate_conversations.sql
```

This will:

1. Identify duplicates
2. Migrate messages
3. Delete duplicates
4. Show summary
5. Auto-commit

**Note**: This is less safe as you can't review before committing. Use the step-by-step method if unsure.
