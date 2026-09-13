/**
 * backfillDefaultTicketTypes.js
 * One-time migration to backfill a default "General Admission" ticket type
 * for events that currently have zero ticket types.
 *
 * Usage:
 *   node backend/scripts/backfillDefaultTicketTypes.js [--dry-run]
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createPool } = require('../config/db');

const isDryRun = process.argv.includes('--dry-run');

// The exact 29 reviewed rows from the dry-run proposal
const PROPOSED_ROWS = [
  { event_id: 42, event_title: "Open Mic: Indie Acoustic Sessions", base_price: 199, total_quantity: null, is_active: true },
  { event_id: 43, event_title: "Sunset Rooftop DJ Set & House Party", base_price: 499, total_quantity: null, is_active: true },
  { event_id: 44, event_title: "SnooSpace Global AI & Product Summit 2026", base_price: 0, total_quantity: null, is_active: true },
  { event_id: 45, event_title: "Saturday Sunrise 10K Run & Coffee Club", base_price: 0, total_quantity: null, is_active: true },
  { event_id: 46, event_title: "Sunday Artisan Sourdough & Brunch Masterclass", base_price: 1499, total_quantity: null, is_active: true },
  { event_id: 47, event_title: "Friday Night Underground Techno Rave", base_price: 799, total_quantity: null, is_active: true },
  { event_id: 48, event_title: "Weekend Western Ghats Waterfall Trek & Camp", base_price: 2999, total_quantity: null, is_active: true },
  { event_id: 49, event_title: "LLM Fine-Tuning & On-Device ML Workshop", base_price: 0, total_quantity: null, is_active: true },
  { event_id: 50, event_title: "Rust for High-Performance Backend Systems", base_price: 0, total_quantity: null, is_active: true },
  { event_id: 51, event_title: "React Native New Architecture & TurboModules Deep Dive", base_price: 0, total_quantity: null, is_active: true },
  { event_id: 52, event_title: "Design Systems at Scale: Figma Variables & Tokens", base_price: 0, total_quantity: null, is_active: true },
  { event_id: 53, event_title: "Micro-Interactions & Mobile Delight Lab", base_price: 0, total_quantity: null, is_active: true },
  { event_id: 54, event_title: "Neon Underground: Cyberpunk Synthwave Night", base_price: 399, total_quantity: null, is_active: true },
  { event_id: 55, event_title: "Craft Beer & Trivia Pub Quiz Night", base_price: 150, total_quantity: null, is_active: true },
  { event_id: 56, event_title: "All-Night Board Games & Strategy Marathon", base_price: 249, total_quantity: null, is_active: true },
  { event_id: 57, event_title: "Valorant & Street Fighter 6 LAN Tournament", base_price: 350, total_quantity: null, is_active: true },
  { event_id: 58, event_title: "Tibetan Singing Bowls & Sound Bath Meditation", base_price: 750, total_quantity: null, is_active: true },
  { event_id: 59, event_title: "Sunrise Vinyasa Flow & Breathwork in the Park", base_price: 0, total_quantity: null, is_active: true },
  { event_id: 60, event_title: "Early Stage Pitch & Angel Investor Mixer", base_price: 999, total_quantity: null, is_active: true },
  { event_id: 61, event_title: "SaaS Pricing & Go-To-Market Playbook 2026", base_price: 0, total_quantity: null, is_active: true },
  { event_id: 62, event_title: "Wheel Throwing & Japanese Raku Pottery Lab", base_price: 1800, total_quantity: null, is_active: true },
  { event_id: 9906, event_title: "TEST_PAYOUT_EVENT_FUTURE", base_price: 0, total_quantity: null, is_active: true },
  { event_id: 9910, event_title: "TEST_PAYOUT_EVENT_FUTURE", base_price: 0, total_quantity: null, is_active: true },
  { event_id: 9912, event_title: "Past Cancelled Event Hold Test", base_price: 0, total_quantity: null, is_active: true },
  { event_id: 9914, event_title: "Past Cancelled Event Hold Test", base_price: 0, total_quantity: null, is_active: true },
  { event_id: 9920, event_title: "Postpone Test Event 1788702114470", base_price: 0, total_quantity: null, is_active: false },
  { event_id: 9926, event_title: "Postpone Test Event 1789238794887", base_price: 0, total_quantity: null, is_active: false },
  { event_id: 9928, event_title: "Past Cancelled Event Hold Test", base_price: 0, total_quantity: null, is_active: true },
  { event_id: 9929, event_title: "D1 Sales Window Persistence Test", base_price: 0, total_quantity: null, is_active: true }
];

async function runMigration() {
  const pool = createPool();
  const client = await pool.connect();

  console.log(`================================================================`);
  console.log(`MIGRATION: backfillDefaultTicketTypes (${isDryRun ? 'DRY-RUN MODE' : 'LIVE EXECUTION'})`);
  console.log(`================================================================`);

  try {
    if (!isDryRun) {
      await client.query('BEGIN');
    }

    let insertedCount = 0;
    let skippedCount = 0;
    const paidUnlimitedEvents = [];

    for (const row of PROPOSED_ROWS) {
      // Re-verify event exists and currently has zero ticket_types
      const checkRes = await client.query(
        `SELECT COUNT(*)::int as count FROM ticket_types WHERE event_id = $1`,
        [row.event_id]
      );

      if (checkRes.rows[0].count > 0) {
        console.log(`[SKIP] Event #${row.event_id} ("${row.event_title}") already has ${checkRes.rows[0].count} ticket types.`);
        skippedCount++;
        continue;
      }

      if (isDryRun) {
        console.log(`[DRY-RUN WOULD INSERT] Event #${row.event_id} ("${row.event_title}") -> name: "General Admission", base_price: ${row.base_price}, is_active: ${row.is_active}, total_quantity: null`);
      } else {
        await client.query(
          `INSERT INTO ticket_types (
            event_id, name, description, base_price, total_quantity,
            sale_start_at, sale_end_at, visibility, access_code,
            min_per_order, max_per_order, max_per_user,
            display_order, is_active, gender_restriction
          ) VALUES (
            $1, 'General Admission', null, $2, $3,
            null, null, 'public', null,
            1, 10, null,
            0, $4, 'all'
          )`,
          [row.event_id, row.base_price, row.total_quantity, row.is_active]
        );
        console.log(`[INSERTED] Event #${row.event_id} ("${row.event_title}") -> name: "General Admission", base_price: ₹${row.base_price}, is_active: ${row.is_active}`);
      }

      insertedCount++;

      if (row.base_price > 0 && row.total_quantity === null) {
        paidUnlimitedEvents.push({ id: row.event_id, title: row.event_title, price: row.base_price });
      }
    }

    if (!isDryRun) {
      await client.query('COMMIT');
      console.log(`\nTransaction committed successfully.`);
    } else {
      console.log(`\nDry-run completed. No changes written.`);
    }

    console.log(`\n----------------------------------------------------------------`);
    console.log(`SUMMARY: ${insertedCount} rows ${isDryRun ? 'would be inserted' : 'inserted'}, ${skippedCount} skipped.`);
    console.log(`----------------------------------------------------------------`);

    if (paidUnlimitedEvents.length > 0) {
      console.log(`\n[INFORMATIONAL FLAG] The following ${paidUnlimitedEvents.length} events have base_price > 0 with total_quantity = NULL (unlimited capacity). Flagged for organizer/admin follow-up:`);
      paidUnlimitedEvents.forEach(e => {
        console.log(`  - Event #${e.id}: "${e.title}" (₹${e.price}, unlimited capacity)`);
      });
    }

  } catch (error) {
    if (!isDryRun) {
      await client.query('ROLLBACK');
      console.error(`\nMigration failed! Transaction rolled back cleanly:`, error);
    } else {
      console.error(`\nDry-run encountered error:`, error);
    }
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
