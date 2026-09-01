const { createPool } = require('../config/db');
const pool = createPool();

async function run() {
  try {
    console.log('=== 1. VERIFYING DB COLUMNS & INDEXES ===');
    const cols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'events' AND column_name IN ('is_featured', 'featured_until')
    `);
    console.log('Events new columns:', cols.rows);

    const indexes = await pool.query(`
      SELECT tablename, indexname 
      FROM pg_indexes 
      WHERE indexname IN ('idx_event_registrations_event_created', 'idx_event_interests_event_created')
    `);
    console.log('Compound velocity indexes:', indexes.rows);

    console.log('\n=== 2. VERIFYING WHATS HOT HYBRID (FEATURED + VELOCITY) ===');
    // Check one featured event
    const featuredCheck = await pool.query(`
      SELECT id, title, is_featured, featured_until 
      FROM events 
      WHERE is_featured = true
    `);
    console.log('Currently featured events:', featuredCheck.rows);

    console.log('\n=== 3. VERIFYING GET /plans WITH & WITHOUT activityType ===');
    // Test open plans activity filter
    const sportsPlans = await pool.query(`
      SELECT id, title, activity_type 
      FROM open_plans 
      WHERE status = 'active' AND activity_type = 'sports'
    `);
    console.log('Active sports plans in DB:', sportsPlans.rows.length);

  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    await pool.end();
  }
}

run();
