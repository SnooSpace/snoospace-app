require('dotenv').config();
const { getFeed } = require('../controllers/postController');

async function test() {
  const req = {
    user: { id: 218, type: 'member' },
    query: { limit: '20' },
  };

  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      if (this.statusCode >= 400) {
        console.error('Error response:', data);
        return;
      }
      console.log(`\n✅ Feed returned ${data.posts?.length || 0} posts (has_more=${data.has_more})`);
      console.log(`next_cursor_time=${data.next_cursor_time}, next_cursor_id=${data.next_cursor_id}`);

      const typeSamples = {};
      for (const p of (data.posts || [])) {
        if (!typeSamples[p.post_type]) {
          typeSamples[p.post_type] = p;
        }
      }

      for (const [type, p] of Object.entries(typeSamples)) {
        console.log(`\n================== SAMPLE [${type.toUpperCase()}] POST (ID: ${p.id}) ==================`);
        if (type === 'poll') {
          console.log(JSON.stringify({
            id: p.id,
            post_type: p.post_type,
            has_voted: p.has_voted,
            voted_indexes: p.voted_indexes,
            type_data: p.type_data,
          }, null, 2));
        } else if (type === 'prompt') {
          console.log(JSON.stringify({
            id: p.id,
            post_type: p.post_type,
            has_submitted: p.has_submitted,
            submission_status: p.submission_status,
            type_data: p.type_data,
            preview_submission: p.preview_submission,
          }, null, 2));
        } else if (type === 'qna') {
          console.log(JSON.stringify({
            id: p.id,
            post_type: p.post_type,
            user_question_count: p.user_question_count,
            type_data: p.type_data,
            preview_question: p.preview_question,
          }, null, 2));
        } else if (type === 'challenge') {
          console.log(JSON.stringify({
            id: p.id,
            post_type: p.post_type,
            has_joined: p.has_joined,
            user_participation: p.user_participation,
            user_submission_count: p.user_submission_count,
            user_submission_status: p.user_submission_status,
            type_data: p.type_data,
            preview_submission: p.preview_submission,
          }, null, 2));
        } else {
          console.log(JSON.stringify({
            id: p.id,
            post_type: p.post_type,
            author_name: p.author_name,
            video_url: p.video_url,
          }, null, 2));
        }
      }
    },
  };

  await getFeed(req, res);
  setTimeout(() => process.exit(0), 1000);
}

test().catch(console.error);
