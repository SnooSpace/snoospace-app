require("dotenv").config();
const { createPool } = require("../config/db");
const { getExploreFeed } = require("../controllers/exploreController");
const pool = createPool();

const req = { user: { id: 155, type: 'member' }, app: { locals: { pool } } };
const res = {
  json: (data) => {
    console.log("=== CATEGORY RAILS ===");
    (data.categoryRails || []).forEach(rail => {
      console.log(`Rail: ${rail.category} (${rail.categorySlug}) - Events: ${rail.events?.length}`);
      rail.events?.forEach(e => {
        console.log(`  - [${e.eventId}] ${e.title} (start: ${e.startDatetime})`);
      });
    });
    console.log("=== CATEGORIES ===");
    console.log(data.categories?.map(c => `${c.name} (${c.slug})`));
    process.exit(0);
  },
  status: (code) => ({
    json: (err) => {
      console.error("Status", code, err);
      process.exit(1);
    }
  })
};

getExploreFeed(req, res);
