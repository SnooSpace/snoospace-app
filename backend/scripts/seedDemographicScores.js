/**
 * Seed Demographic Scores
 *
 * Bootstraps the learned_demographic_scores, age_bands, and location_hierarchy
 * tables with sensible starting values so the AQI demographic component returns
 * something meaningful before the platform has real statistical data.
 *
 * Seeds are labeled confidence_level = 'bootstrap' and sample_size = 0.
 * The weekly learning job will overwrite them with real learned scores once
 * enough users have accumulated behavioral data.
 *
 * Philosophy (from product conversation):
 *   - NO preset "this occupation = this income tier" mappings
 *   - Seeds use broad categories only, not specific occupations
 *   - Age informs BUYING POWER stage only, never interests
 *   - Interests come purely from behavioral event tracking
 *
 * Run: node scripts/seedDemographicScores.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createPool } = require('../config/db');
const pool = createPool();

// ─── Occupation Category Seeds ───────────────────────────────────────────────
// Broad categories only. Specific occupations inherit from their category via
// the resolveOccupationFallback chain in demographicScoreLookup.js.
// Scores represent baseline AQI contribution (0-100 buying power proxy).
// These are STARTING POINTS, not hardcoded truths. Real data overwrites them.
const OCCUPATION_CATEGORY_SEEDS = [
  // Super category: Executive
  { dimension: 'occupation_super', value: 'Executive', score: 82, rationale: 'Founder/CXO/Partner — highest income bracket' },
  // Super category: Professional
  { dimension: 'occupation_super', value: 'Professional', score: 65, rationale: 'Doctors/Lawyers/Consultants — high income, high spending' },
  // Super category: Technical
  { dimension: 'occupation_super', value: 'Technical', score: 58, rationale: 'Engineers/Designers/Developers — mid-high income' },
  // Super category: Creative
  { dimension: 'occupation_super', value: 'Creative', score: 45, rationale: 'Artists/Writers/Musicians — variable income' },
  // Super category: Student
  { dimension: 'occupation_super', value: 'Student', score: 28, rationale: 'Limited current purchasing power but aspirational' },
  // Super category: Other
  { dimension: 'occupation_super', value: 'Other', score: 42, rationale: 'Broad fallback — platform median adjusted' },
];

// ─── Age Band Seeds ───────────────────────────────────────────────────────────
// Age informs life stage / buying power only — NOT interests.
// Interests are 100% behavioral. This is just the buying-power component.
const AGE_BAND_SEEDS = [
  { dimension: 'age_band', value: '18-22', score: 26, rationale: 'Early life stage — limited income, higher aspiration' },
  { dimension: 'age_band', value: '23-28', score: 48, rationale: 'Early career — rising income, active spender' },
  { dimension: 'age_band', value: '29-35', score: 64, rationale: 'Mid career — peak spending phase, family/lifestyle investment' },
  { dimension: 'age_band', value: '36-45', score: 72, rationale: 'Peak earning — established spending power' },
  { dimension: 'age_band', value: '46-60', score: 68, rationale: 'Senior career — high but selective spending' },
  { dimension: 'age_band', value: '60+', score: 58, rationale: 'Retirement / post-career — wealth but category-selective' },
];

// Life stage seeds (broader fallback for age lookups)
const LIFE_STAGE_SEEDS = [
  { dimension: 'age_life_stage', value: 'Early', score: 30, rationale: 'Student / first job phase' },
  { dimension: 'age_life_stage', value: 'Establishing', score: 52, rationale: 'Building career and lifestyle' },
  { dimension: 'age_life_stage', value: 'Established', score: 68, rationale: 'Stable income and spending' },
  { dimension: 'age_life_stage', value: 'Peak', score: 72, rationale: 'Maximum earning and spending' },
  { dimension: 'age_life_stage', value: 'Senior', score: 60, rationale: 'Wealth with selective spend' },
];

// ─── Location City Tier Seeds ─────────────────────────────────────────────────
// City tier is a proxy for average income level in that geography.
// Individual cities can be overridden as the platform learns real data.
const CITY_TIER_SEEDS = [
  { dimension: 'location_city_tier', value: 'Tier1', score: 66, rationale: 'Metro cities — higher avg income and event spending' },
  { dimension: 'location_city_tier', value: 'Tier2', score: 50, rationale: 'Mid-size cities — growing middle class' },
  { dimension: 'location_city_tier', value: 'Tier3', score: 38, rationale: 'Smaller cities — lower avg disposable income' },
];

// ─── Device Tier Seeds ────────────────────────────────────────────────────────
// Tiers are assigned by the classifyDeviceTier() function in authControllerV2.js
// based on brand + model name. These scores are the buying power proxy.
//
// iPhone 15 Pro in Mumbai: ultra_premium (78) × 40% occ + ultra_premium (78) × 20% device
// iPhone 12 in Tier3 city: premium (65) device, Tier3 location (38) → lower combined
// This is exactly the cross-referencing the user asked for — device score alone
// doesn't inflate the AQI; it combines with location.
const DEVICE_TIER_SEEDS = [
  { value: 'ultra_premium', score: 78, rationale: 'iPhone Pro/Max, Samsung Galaxy S flagship — ₹1L+ device spend' },
  { value: 'premium',       score: 65, rationale: 'iPhone 12+, Samsung Galaxy S20+, OnePlus 10+ — ₹50K-1L range' },
  { value: 'mid',           score: 48, rationale: 'iPhone X/11, Samsung A-series, OnePlus mid — ₹20K-50K range' },
  { value: 'budget',        score: 30, rationale: 'Redmi, Realme, basic Android — under ₹20K' },
  { value: 'other',         score: 45, rationale: 'Unknown brand — falls to platform median' },
];

// ─── Age Bands Table ──────────────────────────────────────────────────────────
// Maps exact ages to band + life stage for the fallback chain
const AGE_EXACT_MAPPINGS = [];
for (let age = 13; age <= 80; age++) {
  let band, lifeStage;
  if (age <= 22)       { band = '18-22'; lifeStage = 'Early'; }
  else if (age <= 28)  { band = '23-28'; lifeStage = 'Establishing'; }
  else if (age <= 35)  { band = '29-35'; lifeStage = 'Established'; }
  else if (age <= 45)  { band = '36-45'; lifeStage = 'Peak'; }
  else if (age <= 60)  { band = '46-60'; lifeStage = 'Peak'; }
  else                 { band = '60+';   lifeStage = 'Senior'; }
  AGE_EXACT_MAPPINGS.push({ age_exact: age, age_band: band, life_stage: lifeStage });
}

// ─── Location Hierarchy Seed ──────────────────────────────────────────────────
// Major Indian cities pre-classified into tiers
const CITY_TIER_MAPPINGS = [
  // Tier 1 metros
  { city: 'Mumbai',        tier: 'Tier1' },
  { city: 'Delhi',         tier: 'Tier1' },
  { city: 'Bangalore',     tier: 'Tier1' },
  { city: 'Hyderabad',     tier: 'Tier1' },
  { city: 'Chennai',       tier: 'Tier1' },
  { city: 'Kolkata',       tier: 'Tier1' },
  { city: 'Pune',          tier: 'Tier1' },
  { city: 'Ahmedabad',     tier: 'Tier1' },
  { city: 'Gurugram',      tier: 'Tier1' },
  { city: 'Noida',         tier: 'Tier1' },
  // Tier 2 cities
  { city: 'Jaipur',        tier: 'Tier2' },
  { city: 'Lucknow',       tier: 'Tier2' },
  { city: 'Surat',         tier: 'Tier2' },
  { city: 'Kochi',         tier: 'Tier2' },
  { city: 'Chandigarh',    tier: 'Tier2' },
  { city: 'Indore',        tier: 'Tier2' },
  { city: 'Bhopal',        tier: 'Tier2' },
  { city: 'Nagpur',        tier: 'Tier2' },
  { city: 'Patna',         tier: 'Tier2' },
  { city: 'Vadodara',      tier: 'Tier2' },
  { city: 'Visakhapatnam', tier: 'Tier2' },
  { city: 'Thiruvananthapuram', tier: 'Tier2' },
  { city: 'Coimbatore',   tier: 'Tier2' },
  { city: 'Mysuru',        tier: 'Tier2' },
];

// ─── DB function to ensure get_platform_median_aqi exists ────────────────────
const CREATE_MEDIAN_FUNCTION = `
  CREATE OR REPLACE FUNCTION get_platform_median_aqi()
  RETURNS numeric AS $$
  BEGIN
    RETURN COALESCE(
      (SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY aqi_score)
       FROM user_aqi_signals WHERE aqi_score IS NOT NULL),
      45
    );
  END;
  $$ LANGUAGE plpgsql STABLE;
`;

// ─── Main ─────────────────────────────────────────────────────────────────────
async function seed() {
  console.log('[Seed] Starting demographic score bootstrap...\n');

  try {
    // 1. Create/replace the platform median function
    console.log('[Seed] Creating get_platform_median_aqi() function...');
    await pool.query(CREATE_MEDIAN_FUNCTION);
    console.log('[Seed] ✓ Function created\n');

    // 2. learned_demographic_scores table already exists (created by migration)
    // Skip CREATE TABLE — just use what's there

    // 3. Seed occupation categories
    console.log('[Seed] Seeding occupation category scores...');
    for (const seed of OCCUPATION_CATEGORY_SEEDS) {
      await pool.query(
        `INSERT INTO learned_demographic_scores
           (dimension, dimension_value, learned_score, confidence_level, sample_size)
         VALUES ($1, $2, $3, 'bootstrap', 0)
         ON CONFLICT (dimension, dimension_value) DO UPDATE SET
           learned_score    = EXCLUDED.learned_score,
           confidence_level = CASE
             WHEN learned_demographic_scores.confidence_level = 'bootstrap' THEN 'bootstrap'
             ELSE learned_demographic_scores.confidence_level
           END,
           last_calculated_at = NOW()`,
        [seed.dimension, seed.value, seed.score],
      );
      console.log(`  ✓ ${seed.dimension}=${seed.value}: score=${seed.score} (${seed.rationale})`);
    }

    // 4. Seed device tiers
    console.log('\n[Seed] Seeding device tier scores...');
    for (const seed of DEVICE_TIER_SEEDS) {
      await pool.query(
        `INSERT INTO learned_demographic_scores
           (dimension, dimension_value, learned_score, confidence_level, sample_size)
         VALUES ('device_tier', $1, $2, 'bootstrap', 0)
         ON CONFLICT (dimension, dimension_value) DO UPDATE SET
           learned_score    = EXCLUDED.learned_score,
           confidence_level = CASE
             WHEN learned_demographic_scores.confidence_level = 'bootstrap' THEN 'bootstrap'
             ELSE learned_demographic_scores.confidence_level
           END,
           last_calculated_at = NOW()`,
        [seed.value, seed.score],
      );
      console.log(`  ✓ device_tier=${seed.value}: score=${seed.score} (${seed.rationale})`);
    }

    // 5. Seed age bands
    console.log('\n[Seed] Seeding age band scores...');
    for (const seed of [...AGE_BAND_SEEDS, ...LIFE_STAGE_SEEDS]) {
      await pool.query(
        `INSERT INTO learned_demographic_scores
           (dimension, dimension_value, learned_score, confidence_level, sample_size)
         VALUES ($1, $2, $3, 'bootstrap', 0)
         ON CONFLICT (dimension, dimension_value) DO UPDATE SET
           learned_score    = EXCLUDED.learned_score,
           confidence_level = CASE
             WHEN learned_demographic_scores.confidence_level = 'bootstrap' THEN 'bootstrap'
             ELSE learned_demographic_scores.confidence_level
           END,
           last_calculated_at = NOW()`,
        [seed.dimension, seed.value, seed.score],
      );
      console.log(`  ✓ ${seed.dimension}=${seed.value}: score=${seed.score}`);
    }

    // 5. Seed city tier scores
    console.log('\n[Seed] Seeding city tier scores...');
    for (const seed of CITY_TIER_SEEDS) {
      await pool.query(
        `INSERT INTO learned_demographic_scores
           (dimension, dimension_value, learned_score, confidence_level, sample_size)
         VALUES ($1, $2, $3, 'bootstrap', 0)
         ON CONFLICT (dimension, dimension_value) DO UPDATE SET
           learned_score    = EXCLUDED.learned_score,
           confidence_level = CASE
             WHEN learned_demographic_scores.confidence_level = 'bootstrap' THEN 'bootstrap'
             ELSE learned_demographic_scores.confidence_level
           END,
           last_calculated_at = NOW()`,
        [seed.dimension, seed.value, seed.score],
      );
      console.log(`  ✓ ${seed.dimension}=${seed.value}: score=${seed.score}`);
    }

    // 6. Ensure age_bands table exists and populate
    console.log('\n[Seed] Ensuring age_bands table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS age_bands (
        age_exact INT PRIMARY KEY,
        age_band  TEXT NOT NULL,
        life_stage TEXT NOT NULL
      )
    `);
    for (const row of AGE_EXACT_MAPPINGS) {
      await pool.query(
        `INSERT INTO age_bands (age_exact, age_band, life_stage)
         VALUES ($1, $2, $3)
         ON CONFLICT (age_exact) DO NOTHING`,
        [row.age_exact, row.age_band, row.life_stage],
      );
    }
    console.log(`  ✓ Seeded ${AGE_EXACT_MAPPINGS.length} age rows (ages 13–80)`);

    // 7. Ensure location_hierarchy table and populate with city tiers
    console.log('\n[Seed] Ensuring location_hierarchy table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS location_hierarchy (
        id         SERIAL PRIMARY KEY,
        city       TEXT NOT NULL,
        city_tier  TEXT NOT NULL DEFAULT 'Tier3',
        area_exact TEXT,
        UNIQUE (city, area_exact)
      )
    `);
    for (const row of CITY_TIER_MAPPINGS) {
      await pool.query(
        `INSERT INTO location_hierarchy (city, city_tier)
         VALUES ($1, $2)
         ON CONFLICT (city, area_exact) DO UPDATE SET city_tier = EXCLUDED.city_tier`,
        [row.city, row.tier],
      );
    }
    console.log(`  ✓ Seeded ${CITY_TIER_MAPPINGS.length} cities into location_hierarchy`);

    // 8. Ensure occupation_hierarchy table exists
    console.log('\n[Seed] Ensuring occupation_hierarchy table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS occupation_hierarchy (
        occupation_exact    TEXT PRIMARY KEY,
        occupation_category TEXT,
        occupation_super    TEXT
      )
    `);
    console.log('  ✓ occupation_hierarchy table ready');

    // 9. Ensure platform_config table exists (for decay lambda, etc.)
    console.log('\n[Seed] Ensuring platform_config table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS platform_config (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`
      INSERT INTO platform_config (key, value)
      VALUES ('interest_vector_decay_lambda', '0.02')
      ON CONFLICT (key) DO NOTHING
    `);
    console.log('  ✓ platform_config seeded with decay_lambda=0.02');

    // 10. Summary
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM learned_demographic_scores`
    );
    console.log(`\n[Seed] ✅ Complete. ${countResult.rows[0].count} rows in learned_demographic_scores`);
    console.log('[Seed] Bootstrap confidence scores will be replaced by real learned data as the platform grows.\n');

  } catch (err) {
    console.error('[Seed] ❌ Fatal error:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
