require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  console.log('=== 1. Column Data Types ===');
  const typesRes = await pool.query(`
    SELECT table_name, column_name, data_type, udt_name 
    FROM information_schema.columns 
    WHERE table_name IN ('posts', 'prompt_submissions', 'qna_questions', 'prompt_replies', 'poll_votes', 'challenge_participations', 'challenge_submissions') 
      AND column_name IN ('id', 'post_id')
    ORDER BY table_name, column_name;
  `);
  console.table(typesRes.rows);

  console.log('\n=== 2. Inner Prompt Subqueries for post 162 ===');
  const rawPromptSubs = await pool.query('SELECT post_id, COUNT(*) as cnt FROM prompt_submissions WHERE post_id = 162 GROUP BY post_id');
  console.log('prompt_submissions count for 162:', rawPromptSubs.rows);

  const rawPromptReplies = await pool.query(`
    SELECT ps.post_id, COUNT(*) as cnt
    FROM prompt_replies pr
    JOIN prompt_submissions ps ON pr.submission_id = ps.id
    WHERE ps.post_id = 162 AND ps.status = 'approved'
    GROUP BY ps.post_id
  `);
  console.log('prompt_replies count for 162:', rawPromptReplies.rows);

  console.log('\n=== 3. Running Current Prompt Counts Query with [162] ===');
  const promptIds = [162];
  try {
    const curPrompt = await pool.query(
      `SELECT 
         p.id as post_id,
         COALESCE(sub_counts.cnt, 0)::int as submission_count,
         COALESCE(rep_counts.cnt, 0)::int as total_reply_count
       FROM UNNEST($1::int[]) AS p(id)
       LEFT JOIN (
         SELECT post_id, COUNT(*) as cnt
         FROM prompt_submissions
         WHERE post_id = ANY($1::int[])
         GROUP BY post_id
       ) sub_counts ON sub_counts.post_id = p.id
       LEFT JOIN (
         SELECT ps.post_id, COUNT(*) as cnt
         FROM prompt_replies pr
         JOIN prompt_submissions ps ON pr.submission_id = ps.id
         WHERE ps.post_id = ANY($1::int[]) AND ps.status = 'approved'
         GROUP BY ps.post_id
       ) rep_counts ON rep_counts.post_id = p.id`,
      [promptIds]
    );
    console.log('Current prompt counts query result:', curPrompt.rows);
  } catch (e) {
    console.error('Error running current prompt counts query:', e.message);
  }

  console.log('\n=== 4. Inner Q&A Subqueries for post 164 ===');
  const rawQna = await pool.query('SELECT post_id, COUNT(*) as question_count, COUNT(*) FILTER (WHERE answered_at IS NOT NULL) as answered_count FROM qna_questions WHERE post_id = 164 GROUP BY post_id');
  console.log('qna_questions count for 164:', rawQna.rows);

  console.log('\n=== 5. Running Current Q&A Counts Query with [164] ===');
  const qnaIds = [164];
  try {
    const curQna = await pool.query(
      `SELECT 
         p.id as post_id,
         COALESCE(q_counts.question_count, 0)::int as question_count,
         COALESCE(q_counts.answered_count, 0)::int as answered_count,
         COALESCE(u_counts.user_question_count, 0)::int as user_question_count
       FROM UNNEST($1::int[]) AS p(id)
       LEFT JOIN (
         SELECT 
           post_id,
           COUNT(*) as question_count,
           COUNT(*) FILTER (WHERE answered_at IS NOT NULL) as answered_count
         FROM qna_questions 
         WHERE post_id = ANY($1::int[]) AND is_hidden = false
         GROUP BY post_id
       ) q_counts ON q_counts.post_id = p.id
       LEFT JOIN (
         SELECT 
           post_id,
           COUNT(*) as user_question_count
         FROM qna_questions
         WHERE post_id = ANY($1::int[])
           AND author_id = $2 AND author_type = $3
         GROUP BY post_id
       ) u_counts ON u_counts.post_id = p.id`,
      [qnaIds, 52, 'member']
    );
    console.log('Current Q&A counts query result:', curQna.rows);
  } catch (e) {
    console.error('Error running current Q&A counts query:', e.message);
  }
}

run().then(() => pool.end()).catch(console.error);
