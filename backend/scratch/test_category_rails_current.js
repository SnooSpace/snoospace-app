require('dotenv').config();
const { createPool } = require('../config/db');
const pool = createPool();
const { getCategoryColor } = require('../utils/categoryColors');
const { MAIN_EVENT_CATEGORIES } = require('../constants/eventCategories');

async function testCategoryRails() {
  const allSubcatsRes = await pool.query(
    `SELECT id, name, slug FROM discover_categories WHERE is_active = true`
  );
  const allSubcats = allSubcatsRes.rows;

  const valueTuples = [];
  const mainCatMap = new Map();

  MAIN_EVENT_CATEGORIES.forEach((mainCat, index) => {
    const subcatNamesLower = mainCat.subcategories.map(s => s.toLowerCase());
    const matchingRows = allSubcats.filter(row => 
      subcatNamesLower.includes(row.name.toLowerCase()) || 
      row.slug === mainCat.slug ||
      row.name.toLowerCase() === mainCat.name.toLowerCase()
    );
    const primaryId = matchingRows.find(r => r.slug === mainCat.slug)?.id || matchingRows[0]?.id || (index + 1);

    mainCatMap.set(mainCat.slug, {
      id: primaryId,
      name: mainCat.name,
      slug: mainCat.slug,
      displayOrder: index + 1,
      userScore: 0
    });

    matchingRows.forEach(row => {
      const escapedSlug = mainCat.slug.replace(/'/g, "''");
      valueTuples.push(`(${parseInt(row.id, 10)}, '${escapedSlug}')`);
    });
  });

  const valuesClause = valueTuples.join(", ");

  const eventsQuery = `
    SELECT DISTINCT ON (cp.main_slug, e.id)
      e.id as "eventId", 
      e.title, 
      e.banner_url as "coverUrl",
      e.start_datetime as "startDatetime",
      e.end_datetime as "endDatetime",
      e.event_type as "eventType",
      cp.main_slug as "mainSlug"
    FROM events e
    INNER JOIN event_discover_categories edc ON e.id = edc.event_id
    INNER JOIN (
      VALUES ${valuesClause}
    ) AS cp(subcat_id, main_slug) ON edc.category_id = cp.subcat_id
    WHERE e.start_datetime > NOW()
      AND e.is_published = true
      AND e.is_cancelled IS NOT TRUE
    ORDER BY cp.main_slug, e.id, e.start_datetime ASC
  `;

  const eventsRes = await pool.query(eventsQuery);
  console.log("Current backend events count:", eventsRes.rows.length);
  const foodEvents = eventsRes.rows.filter(r => r.mainSlug === 'food-dining');
  console.log("Current food events:", foodEvents);

  process.exit(0);
}

testCategoryRails().catch(e => { console.error(e); process.exit(1); });
