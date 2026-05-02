/**
 * Gender Fit Calculator
 *
 * Calculates how well a creator's audience gender breakdown matches
 * a brand's target gender split. Also provides gender-category affinity
 * lookups from learned platform data.
 *
 * Gender never affects individual AQI scores — it only lives in
 * brand-creator matching and category affinity insights.
 */

/**
 * Calculate gender fit score between creator audience and brand target.
 * Returns 0–100. Gender-neutral campaigns (no target) always return 100.
 */
function calculateGenderFitScore(creatorAudienceGenderBreakdown, brandTargetGenderBreakdown) {
  // Gender-neutral campaign — gender fit is irrelevant
  if (!brandTargetGenderBreakdown) return 100;

  const genders = ["Male", "Female", "Non-binary"];

  // Normalize brand target to percentages summing to 100
  const total = genders.reduce((sum, g) => {
    return sum + (brandTargetGenderBreakdown[g] ?? 0);
  }, 0);

  if (total === 0) return 100; // brand didn't specify — treat as neutral

  const normalizedTarget = {};
  for (const g of genders) {
    normalizedTarget[g] = ((brandTargetGenderBreakdown[g] ?? 0) / total) * 100;
  }

  // Sum of absolute differences, divided by 2 to avoid double-counting
  const totalDiff = genders.reduce((sum, g) => {
    const target = normalizedTarget[g] ?? 0;
    const actual = (creatorAudienceGenderBreakdown || {})[g] ?? 0;
    return sum + Math.abs(target - actual);
  }, 0);

  return Math.max(0, Math.round(100 - (totalDiff / 2)));
}

/**
 * Fetch gender affinity insights for a specific category.
 * e.g. "Female users engage with wellness 1.4x more than average"
 */
async function getGenderAffinityForCategory(pool, category) {
  const result = await pool.query(`
    SELECT gender, affinity_index, confidence_level, sample_size
    FROM learned_gender_category_affinity
    WHERE category = $1
      AND confidence_level != 'insufficient'
    ORDER BY affinity_index DESC
  `, [category]);

  return result.rows;
}

/**
 * Fetch top categories for a specific gender based on affinity index.
 */
async function getTopCategoriesForGender(pool, gender, limit = 5) {
  const result = await pool.query(`
    SELECT category, affinity_index, confidence_level
    FROM learned_gender_category_affinity
    WHERE gender = $1
      AND confidence_level IN ('high', 'medium')
      AND affinity_index > 1.0
    ORDER BY affinity_index DESC
    LIMIT $2
  `, [gender, limit]);

  return result.rows;
}

module.exports = {
  calculateGenderFitScore,
  getGenderAffinityForCategory,
  getTopCategoriesForGender,
};
