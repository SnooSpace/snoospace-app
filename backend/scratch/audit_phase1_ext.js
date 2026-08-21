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
    console.log('=============================================');
    console.log('POINT 1: COMMUNITY CATEGORY SCHEMA & CONSTRAINTS');
    console.log('=============================================');
    const constraints = await c.query(`
      SELECT conname, contype, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'communities'
    `);
    console.table(constraints.rows);

    const comSchema = await c.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'communities' AND column_name IN ('category', 'categories', 'community_type', 'club_type')
    `);
    console.table(comSchema.rows);

    const allComs = await c.query(`
      SELECT id, name, category, categories, community_type, club_type
      FROM communities
      ORDER BY id
    `);
    console.table(allComs.rows);

    console.log('=============================================');
    console.log('POINT 2: POSTS COMMUNITY AFFILIATION & MEMBER POSTS');
    console.log('=============================================');
    const postsWithAffiliation = await c.query(`
      SELECT id, post_type, author_id, author_type, source_id, source_type, tagged_entities, type_data
      FROM posts
      WHERE post_type IN ('poll', 'prompt', 'qna', 'challenge', 'community_voice', 'media')
      ORDER BY id DESC
      LIMIT 15
    `);
    console.log(JSON.stringify(postsWithAffiliation.rows, null, 2));

    console.log('=============================================');
    console.log('POINT 3: USER COMMUNITY CATEGORY AFFINITY & JOINS');
    console.log('=============================================');
    // Follows table
    const followCols = await c.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'follows'
    `);
    console.log('follows columns:', followCols.rows);

    // community_member_circles table
    const cmcCols = await c.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'community_member_circles'
    `);
    console.log('community_member_circles columns:', cmcCols.rows);

    // Sample user category affinity query for member 51
    const userCategoryAffinity = await c.query(`
      SELECT DISTINCT c.category, c.categories, c.name, 'follow' as relation
      FROM follows f
      JOIN communities c ON f.following_id = c.id AND f.following_type = 'community'
      WHERE f.follower_id = 51 AND f.follower_type = 'member' AND f.is_superseded_by_circle = false
      UNION
      SELECT DISTINCT c.category, c.categories, c.name, 'circle' as relation
      FROM community_member_circles cmc
      JOIN communities c ON cmc.community_id = c.id
      WHERE cmc.member_id = 51
    `);
    console.log('User 51 community category affinity via follows/circles:');
    console.table(userCategoryAffinity.rows);

    console.log('=============================================');
    console.log('POINT 4: FIRST SHOWN / SERVE TRACKING & IMPRESSION TABLES');
    console.log('=============================================');
    const viewTables = await c.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND (table_name LIKE '%view%' OR table_name LIKE '%impression%' OR table_name LIKE '%feed%')
    `);
    console.log('View/Impression tables:', viewTables.rows.map(r => r.table_name));

    for (const t of viewTables.rows) {
      console.log(`\nColumns for ${t.table_name}:`);
      const cols = await c.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = $1
      `, [t.table_name]);
      console.table(cols.rows);
    }

  } finally {
    c.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
