/**
 * Demographic Score Lookup Utility
 *
 * Resolves learned demographic scores using hierarchical fallback.
 * No hardcoded scores anywhere — everything comes from learned_demographic_scores
 * which is populated by the weekly learning job from real platform behavior.
 */

/**
 * Fetch the platform median AQI — the ultimate fallback when no learned
 * score exists with sufficient confidence.
 * Returns 45 on a cold-start platform with no data at all.
 */
async function getPlatformMedianAqi(pool) {
  try {
    const result = await pool.query(`SELECT get_platform_median_aqi() AS median`);
    return parseFloat(result.rows[0]?.median) || 45;
  } catch (err) {
    console.error("[DemographicLookup] getPlatformMedianAqi error:", err.message);
    return 45;
  }
}

/**
 * Resolve a learned score by walking down the fallback chain until a score
 * with sufficient confidence is found.
 *
 * @param {Pool} pool - DB connection pool
 * @param {string} dimension - e.g. 'occupation_exact'
 * @param {string|number} value - e.g. 'Software Engineer' or '24'
 * @param {Array} fallbackChain - [{dimension, value}, ...] ordered from specific to broad
 * @returns {{ score: number, confidence: string, source: string }}
 */
async function getLearnedDemographicScore(pool, dimension, value, fallbackChain = []) {
  const lookupChain = [
    { dimension, value: String(value) },
    ...fallbackChain.filter((f) => f.value != null),
  ];

  for (const lookup of lookupChain) {
    try {
      const { rows } = await pool.query(
        `SELECT learned_score, confidence_level, sample_size
         FROM learned_demographic_scores
         WHERE dimension = $1 AND dimension_value = $2
         LIMIT 1`,
        [lookup.dimension, String(lookup.value)],
      );

      if (rows.length > 0 && rows[0].confidence_level !== "insufficient") {
        return {
          score: parseFloat(rows[0].learned_score),
          confidence: rows[0].confidence_level,
          source: lookup.dimension,
        };
      }
    } catch (err) {
      console.error(
        `[DemographicLookup] Error querying ${lookup.dimension}=${lookup.value}:`,
        err.message,
      );
    }
  }

  // Nothing found with enough confidence — return platform median
  return {
    score: await getPlatformMedianAqi(pool),
    confidence: "low",
    source: "platform_median",
  };
}

/**
 * Build the fallback chain for an occupation lookup.
 * Reads from occupation_hierarchy to find category and super-category.
 */
async function resolveOccupationFallback(pool, occupationExact) {
  if (!occupationExact) return [];

  try {
    const { rows } = await pool.query(
      `SELECT occupation_category, occupation_super
       FROM occupation_hierarchy
       WHERE occupation_exact = $1
       LIMIT 1`,
      [occupationExact],
    );

    if (rows.length === 0) return [];

    return [
      { dimension: "occupation_category", value: rows[0].occupation_category },
      { dimension: "occupation_super", value: rows[0].occupation_super },
    ].filter((f) => f.value != null);
  } catch (err) {
    console.error("[DemographicLookup] resolveOccupationFallback error:", err.message);
    return [];
  }
}

/**
 * Build the fallback chain for an age lookup.
 * Reads from age_bands to find band and life stage.
 */
async function resolveAgeFallback(pool, ageExact) {
  if (ageExact == null) return [];

  try {
    const { rows } = await pool.query(
      `SELECT age_band, life_stage
       FROM age_bands
       WHERE age_exact = $1
       LIMIT 1`,
      [ageExact],
    );

    if (rows.length === 0) return [];

    return [
      { dimension: "age_band", value: rows[0].age_band },
      { dimension: "age_life_stage", value: rows[0].life_stage },
    ].filter((f) => f.value != null);
  } catch (err) {
    console.error("[DemographicLookup] resolveAgeFallback error:", err.message);
    return [];
  }
}

/**
 * Ensure a new occupation is tracked in the hierarchy.
 * Called from onboarding flow — inserts with null category/super
 * if the occupation doesn't exist yet. The learning job will eventually
 * discover it; admin can also manually assign categories.
 */
async function ensureOccupationInHierarchy(pool, occupationExact, occupationCategory) {
  if (!occupationExact) return;

  try {
    await pool.query(
      `INSERT INTO occupation_hierarchy (occupation_exact, occupation_category, occupation_super)
       VALUES ($1, $2, NULL)
       ON CONFLICT (occupation_exact) DO UPDATE SET
         occupation_category = COALESCE(occupation_hierarchy.occupation_category, $2)`,
      [occupationExact, occupationCategory || null],
    );
  } catch (err) {
    // Non-fatal — don't break onboarding
    console.error("[DemographicLookup] ensureOccupationInHierarchy error:", err.message);
  }
}

// ── Location utilities ──

/**
 * Canonical city name aliases — handles common spelling variations.
 * Users type "Bengaluru", "Bombay", "Calcutta" — all resolve to the
 * canonical name used in location_hierarchy.
 */
const CITY_ALIASES = {
  'Bengaluru':      'Bangalore',
  'Bombay':         'Mumbai',
  'Calcutta':       'Kolkata',
  'Madras':         'Chennai',
  'Gurgaon':        'Gurugram',
  'Prayagraj':      'Allahabad',
  'Vishakhapatnam': 'Visakhapatnam',
  'Vizag':          'Visakhapatnam',
  'Mysore':         'Mysuru',
  'Mangalore':      'Mangaluru',
  'Cochin':         'Kochi',
  'Trivandrum':     'Thiruvananthapuram',
  'Pondichery':     'Pondicherry',
  'Ooty':           'Udhagamandalam',
  'Belagavi':       'Belgaum',
};

/**
 * Normalize a city name — trim whitespace and resolve aliases.
 */
function normalizeCity(city) {
  if (!city) return null;
  const trimmed = city.trim();
  return CITY_ALIASES[trimmed] ?? trimmed;
}

/**
 * Build the fallback chain for a location lookup.
 * Walks: area → city → city_tier → platform median
 */
async function resolveLocationFallback(pool, city, area) {
  if (!city) return [];

  const normalizedCityName = normalizeCity(city);

  try {
    const { rows } = await pool.query(
      `SELECT city_tier FROM location_hierarchy WHERE city = $1 LIMIT 1`,
      [normalizedCityName],
    );

    const cityTier = rows[0]?.city_tier ?? null;

    return [
      area ? { dimension: "location_area", value: area } : null,
      normalizedCityName ? { dimension: "location_city", value: normalizedCityName } : null,
      cityTier ? { dimension: "location_city_tier", value: cityTier } : null,
    ].filter(Boolean);
  } catch (err) {
    console.error("[DemographicLookup] resolveLocationFallback error:", err.message);
    return [];
  }
}

/**
 * Auto-register a city (and optionally an area) in the location hierarchy.
 * Called during onboarding — inserts unknown cities with 'Tier3' default.
 * If the city exists but the area is new, adds the area row inheriting
 * the city's tier.
 */
async function ensureCityInHierarchy(pool, rawCity, area) {
  if (!rawCity) return;

  const city = normalizeCity(rawCity);

  try {
    const existing = await pool.query(
      `SELECT id, city_tier FROM location_hierarchy WHERE city = $1 AND area_exact IS NULL LIMIT 1`,
      [city],
    );

    if (existing.rows.length === 0) {
      // New city — insert with Tier3 default (conservative starting point)
      await pool.query(
        `INSERT INTO location_hierarchy (city, city_tier, area_exact)
         VALUES ($1, 'Tier3', $2)
         ON CONFLICT DO NOTHING`,
        [city, area || null],
      );
    } else if (area) {
      // City exists — check if this neighborhood is registered
      const areaExists = await pool.query(
        `SELECT id FROM location_hierarchy WHERE city = $1 AND area_exact = $2 LIMIT 1`,
        [city, area],
      );

      if (areaExists.rows.length === 0) {
        // Inherits city_tier from the parent city row
        await pool.query(
          `INSERT INTO location_hierarchy (city, city_tier, area_exact)
           SELECT $1, city_tier, $2 FROM location_hierarchy
           WHERE city = $1 AND area_exact IS NULL LIMIT 1
           ON CONFLICT DO NOTHING`,
          [city, area],
        );
      }
    }
  } catch (err) {
    console.error("[DemographicLookup] ensureCityInHierarchy error:", err.message);
  }
}

module.exports = {
  getPlatformMedianAqi,
  getLearnedDemographicScore,
  resolveOccupationFallback,
  resolveAgeFallback,
  ensureOccupationInHierarchy,
  resolveLocationFallback,
  ensureCityInHierarchy,
  normalizeCity,
  CITY_ALIASES,
};
