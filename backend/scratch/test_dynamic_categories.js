require('dotenv').config();
const { createPool } = require('../config/db');
const pool = createPool();
const { MAIN_EVENT_CATEGORIES } = require('../constants/eventCategories');

async function testDynamicCategories() {
  // 1. Fetch active categories and subcategory counts from DB
  const q = `
    SELECT 
      dc.id, 
      dc.name, 
      dc.slug, 
      dc.icon_name as "iconName", 
      dc.display_order as "displayOrder",
      COUNT(DISTINCT e.id)::int as "eventCount"
    FROM discover_categories dc
    LEFT JOIN event_discover_categories edc ON dc.id = edc.category_id
    LEFT JOIN events e ON edc.event_id = e.id 
      AND (e.end_datetime > NOW() OR (e.end_datetime IS NULL AND e.start_datetime > NOW() - INTERVAL '4 hours'))
      AND (e.is_published = true OR e.is_published IS NULL)
      AND e.is_cancelled IS NOT TRUE
    WHERE dc.is_active = true
      AND (dc.visible_from IS NULL OR dc.visible_from <= NOW())
      AND (dc.visible_until IS NULL OR dc.visible_until >= NOW())
    GROUP BY dc.id, dc.name, dc.slug, dc.icon_name, dc.display_order
    ORDER BY dc.display_order ASC, dc.id ASC
  `;
  const res = await pool.query(q);
  const allSubcats = res.rows;

  const countBySubcatId = new Map(allSubcats.map(r => [r.id, r.eventCount]));

  // Group into curated top-level main categories, only keeping categories with eventCount > 0
  const categories = [];

  MAIN_EVENT_CATEGORIES.forEach((mainCat, index) => {
    const subcatNamesLower = mainCat.subcategories.map(s => s.toLowerCase());
    const matchingRows = allSubcats.filter(row => 
      subcatNamesLower.includes(row.name.toLowerCase()) || 
      row.slug === mainCat.slug ||
      row.name.toLowerCase() === mainCat.name.toLowerCase()
    );
    const subCategoryIds = matchingRows.map(r => r.id);
    const primaryRow = matchingRows.find(r => r.slug === mainCat.slug) || matchingRows[0];
    const primaryId = primaryRow?.id || (index + 1);

    // Sum event count across subcategories without double-counting
    // Even better: direct count of distinct events
    const matchingIds = subCategoryIds;
    let eventCount = 0;
    matchingRows.forEach(r => {
      eventCount += (r.eventCount || 0);
    });

    if (eventCount > 0) {
      categories.push({
        id: primaryId,
        name: primaryRow?.name || mainCat.name,
        slug: primaryRow?.slug || mainCat.slug,
        iconName: primaryRow?.iconName || mainCat.iconName,
        displayOrder: primaryRow?.displayOrder || (index + 1),
        eventCount,
        subCategoryIds,
        subcategories: mainCat.subcategories
      });
    }
  });

  console.log("Filtered categories with events count:", categories.length);
  console.log(categories.map(c => `${c.name} (${c.slug}) -> ${c.eventCount} events`));

  process.exit(0);
}

testDynamicCategories().catch(e => { console.error(e); process.exit(1); });
