require('dotenv').config();
const { Pool } = require('pg');
const { hydratePostInteractions } = require('../services/postHydration');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  console.log('=== 1. Inspect Raw poll_votes query for post 161, viewer 52 (member) ===');
  const rawVoteRes = await pool.query(
    `SELECT post_id, option_index 
     FROM poll_votes 
     WHERE post_id = ANY($1::bigint[]) AND voter_id = $2 AND voter_type = $3`,
    [[161], 52, 'member']
  );
  console.log('Raw poll_votes rows:', rawVoteRes.rows);
  console.log('typeof row.post_id:', typeof rawVoteRes.rows[0]?.post_id);
  console.log('typeof row.option_index:', typeof rawVoteRes.rows[0]?.option_index);

  console.log('\n=== 2. Running hydratePostInteractions on post 161 for viewer 52 (member) ===');
  const postRes = await pool.query('SELECT * FROM posts WHERE id = 161');
  const post = {
    ...postRes.rows[0],
    type_data: typeof postRes.rows[0].type_data === 'string' ? JSON.parse(postRes.rows[0].type_data) : postRes.rows[0].type_data,
  };

  console.log('Input post.id:', post.id, '(typeof:', typeof post.id + ')');

  const hydrated = await hydratePostInteractions([post], 52, 'member', pool);
  console.log('\nHydrated Poll Post Result:');
  console.log(JSON.stringify({
    id: hydrated[0].id,
    post_type: hydrated[0].post_type,
    has_voted: hydrated[0].has_voted,
    voted_indexes: hydrated[0].voted_indexes,
    type_data: hydrated[0].type_data,
  }, null, 2));

  console.log('\n=== 3. Running hydratePostInteractions on post 161 for NON-voter (viewer 99999) ===');
  const nonVoterPost = {
    ...postRes.rows[0],
    type_data: typeof postRes.rows[0].type_data === 'string' ? JSON.parse(postRes.rows[0].type_data) : postRes.rows[0].type_data,
  };
  const nonVoterHydrated = await hydratePostInteractions([nonVoterPost], 99999, 'member', pool);
  console.log('Non-voter result:', {
    id: nonVoterHydrated[0].id,
    has_voted: nonVoterHydrated[0].has_voted,
    voted_indexes: nonVoterHydrated[0].voted_indexes,
  });
}

run().then(() => pool.end()).catch(console.error);
