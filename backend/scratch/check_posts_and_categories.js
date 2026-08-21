require('dotenv').config({ path: __dirname + '/../.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: +process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const c = await pool.connect();
  try {
    console.log('=== COMMUNITY CATEGORIES & CREATOR PROFILES ===');
    const tableNames = ['community_categories', 'discover_categories', 'event_discover_categories', 'creator_profiles'];
    for (const t of tableNames) {
      const exists = await c.query('SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name=$1)', [t]);
      if (exists.rows[0].exists) {
        console.log(`\nTable ${t} exists:`);
        const cols = await c.query('SELECT column_name, data_type FROM information_schema.columns WHERE table_name=$1', [t]);
        console.table(cols.rows);
        const rows = await c.query(`SELECT * FROM ${t} LIMIT 5`);
        console.log('Sample rows:', rows.rows);
      } else {
        console.log(`\nTable ${t} does NOT exist.`);
      }
    }

    console.log('\n=== POSTS LINKED CHALLENGE / SOURCE / TARGET ===');
    const postTypes = await c.query(`
      SELECT post_type, author_type, COUNT(*) as count
      FROM posts
      GROUP BY post_type, author_type
      ORDER BY post_type, author_type
    `);
    console.table(postTypes.rows);

    const memberPosts = await c.query(`
      SELECT id, post_type, author_id, author_type, caption, tagged_entities, linked_challenge_id, source_id, source_type, type_data
      FROM posts
      WHERE author_type = 'member'
      LIMIT 10
    `);
    console.log('\nMember-authored posts sample:');
    console.log(JSON.stringify(memberPosts.rows, null, 2));

    const challenges = await c.query(`
      SELECT id, community_id, creator_id, creator_type, title, category
      FROM challenges
      LIMIT 5
    `);
    console.log('\nChallenges sample:');
    console.table(challenges.rows);

  } finally {
    c.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
