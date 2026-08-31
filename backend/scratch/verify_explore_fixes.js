require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createPool } = require("../config/db");
const { getExploreFeed } = require("../controllers/exploreController");

const pool = createPool();

async function runTest() {
  try {
    console.log("=== Testing Explore Controller Fixes ===");
    
    // Pick a test user
    const userRes = await pool.query("SELECT id FROM members LIMIT 1");
    if (userRes.rows.length === 0) {
      console.log("No members found in database");
      process.exit(0);
    }
    const testUserId = userRes.rows[0].id;
    console.log(`Using test userId: ${testUserId}`);

    let responseData = null;
    const req = {
      user: { id: testUserId, type: "member" },
      app: { locals: { pool } }
    };
    const res = {
      status: (code) => {
        console.log(`Response status: ${code}`);
        return {
          json: (data) => {
            console.error("Error response:", data);
            responseData = data;
          }
        };
      },
      json: (data) => {
        responseData = data;
      }
    };

    await getExploreFeed(req, res);

    if (!responseData || !responseData.success) {
      console.error("Failed to get explore feed response:", responseData);
      process.exit(1);
    }

    console.log("\n--- Section Counts ---");
    console.log(`Live now: ${(responseData.liveNow || []).length}`);
    console.log(`Hero: ${responseData.hero ? responseData.hero.title : "None"}`);
    console.log(`Weekend: ${(responseData.weekend || []).length}`);
    console.log(`Category Rails: ${(responseData.categoryRails || []).length}`);
    console.log(`Something Different: ${(responseData.somethingDifferent || []).length}`);

    // Check Category Rails
    console.log("\n--- Category Rails Details ---");
    const seenCategoryRailEventIds = new Set();
    let crossRailDuplicates = 0;

    for (const rail of responseData.categoryRails || []) {
      console.log(`Rail: "${rail.category}" (slug: ${rail.categorySlug}) -> ${rail.events.length} events`);
      for (const event of rail.events) {
        if (seenCategoryRailEventIds.has(event.eventId)) {
          console.error(`  [DUPLICATE DETECTED] Event ID ${event.eventId} ("${event.title}") appears multiple times across rails!`);
          crossRailDuplicates++;
        } else {
          seenCategoryRailEventIds.add(event.eventId);
        }
      }
    }

    if (crossRailDuplicates === 0) {
      console.log("✅ Zero cross-rail duplicate events in category rails!");
    } else {
      console.error(`❌ Found ${crossRailDuplicates} cross-rail duplicate events!`);
    }

    // Check Cross-Section Dedup for Something Different
    console.log("\n--- Cross-Section Dedup Check for Something Different ---");
    const upperSectionIds = new Set();
    if (responseData.hero?.eventId) upperSectionIds.add(String(responseData.hero.eventId));
    (responseData.liveNow || []).forEach(e => upperSectionIds.add(String(e.eventId)));
    (responseData.weekend || []).forEach(e => upperSectionIds.add(String(e.eventId)));
    (responseData.categoryRails || []).forEach(r => r.events.forEach(e => upperSectionIds.add(String(e.eventId))));

    let upperSectionCollisions = 0;
    const somethingDifferentIds = new Set();
    let somethingDifferentInternalDuplicates = 0;

    for (const event of responseData.somethingDifferent || []) {
      if (upperSectionIds.has(String(event.eventId))) {
        console.error(`  [CROSS-SECTION DUPLICATE] Event ID ${event.eventId} ("${event.title}") also exists in upper sections!`);
        upperSectionCollisions++;
      }
      if (somethingDifferentIds.has(String(event.eventId))) {
        console.error(`  [INTERNAL DUPLICATE] Event ID ${event.eventId} appears multiple times in Something Different!`);
        somethingDifferentInternalDuplicates++;
      }
      somethingDifferentIds.add(String(event.eventId));
    }

    if (upperSectionCollisions === 0) {
      console.log("✅ Zero collisions between Something Different and upper sections!");
    } else {
      console.error(`❌ Found ${upperSectionCollisions} cross-section duplicate events!`);
    }

    if (somethingDifferentInternalDuplicates === 0) {
      console.log("✅ Zero duplicate rows in Something Different rail!");
    } else {
      console.error(`❌ Found ${somethingDifferentInternalDuplicates} duplicate rows in Something Different!`);
    }

    console.log("\n=== Test Completed Successfully ===");
    process.exit(0);
  } catch (err) {
    console.error("Test error:", err);
    process.exit(1);
  }
}

runTest();
