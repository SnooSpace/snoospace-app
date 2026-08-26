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
  const sub = await pool.query('SELECT post_id, author_id, author_type, status FROM prompt_submissions LIMIT 5');
  console.log('Prompt submission samples:', sub.rows);

  if (sub.rows.length > 0) {
    const s = sub.rows[0];
    const r = await pool.query('SELECT * FROM posts WHERE id = $1', [s.post_id]);
    const post = {
      ...r.rows[0],
      type_data: typeof r.rows[0].type_data === 'string' ? JSON.parse(r.rows[0].type_data) : r.rows[0].type_data,
    };

    const hydrated = await hydratePostInteractions([post], s.author_id, s.author_type, pool);
    console.log('\nHydrated Prompt Post (ID: ' + hydrated[0].id + ') for Viewer ' + s.author_id + ':');
    console.log(JSON.stringify({
      id: hydrated[0].id,
      post_type: hydrated[0].post_type,
      has_submitted: hydrated[0].has_submitted,
      submission_status: hydrated[0].submission_status,
      type_data: hydrated[0].type_data,
      preview_submission: hydrated[0].preview_submission,
    }, null, 2));
  }
}

run().then(() => pool.end()).catch(console.error);
