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
  console.log('Testing Q&A post hydration...');
  const qnaPostRes = await pool.query("SELECT * FROM posts WHERE post_type = 'qna' LIMIT 1");
  if (qnaPostRes.rows.length > 0) {
    const p = qnaPostRes.rows[0];
    const post = {
      ...p,
      type_data: typeof p.type_data === 'string' ? JSON.parse(p.type_data) : p.type_data,
    };
    const hydrated = await hydratePostInteractions([post], 52, 'member', pool);
    console.log('\nHydrated Q&A Post (ID: ' + hydrated[0].id + '):');
    console.log(JSON.stringify({
      id: hydrated[0].id,
      post_type: hydrated[0].post_type,
      user_question_count: hydrated[0].user_question_count,
      type_data: hydrated[0].type_data,
      preview_question: hydrated[0].preview_question,
    }, null, 2));
  }

  console.log('\nTesting Challenge post hydration...');
  const chalPostRes = await pool.query("SELECT * FROM posts WHERE post_type = 'challenge' LIMIT 1");
  if (chalPostRes.rows.length > 0) {
    const p = chalPostRes.rows[0];
    const post = {
      ...p,
      type_data: typeof p.type_data === 'string' ? JSON.parse(p.type_data) : p.type_data,
    };
    const hydrated = await hydratePostInteractions([post], 52, 'member', pool);
    console.log('\nHydrated Challenge Post (ID: ' + hydrated[0].id + '):');
    console.log(JSON.stringify({
      id: hydrated[0].id,
      post_type: hydrated[0].post_type,
      has_joined: hydrated[0].has_joined,
      user_participation: hydrated[0].user_participation,
      user_submission_count: hydrated[0].user_submission_count,
      user_submission_status: hydrated[0].user_submission_status,
      type_data: hydrated[0].type_data,
      preview_submission: hydrated[0].preview_submission,
    }, null, 2));
  }
}

run().then(() => pool.end()).catch(console.error);
