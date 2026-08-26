/**
 * ==============================================================================
 * SnooSpace Post Hydration Service (Batched Post-Type Interaction Hydration)
 * ==============================================================================
 * 
 * Replaces per-post N+1 secondary queries with batched queries for:
 *   - Polls (user vote state)
 *   - Prompts (counts, user submission state, preview submission)
 *   - Q&As (counts, user question count, preview question with upvote state)
 *   - Challenges (counts, user participation/progress, featured preview)
 * 
 * Performance:
 *   Reduces ~15-25 sequential round-trips to ~2-3 batched queries total per feed page.
 */

/**
 * Hydrates interactive type-specific data for an array of posts in batch.
 * 
 * @param {Array<Object>} posts - Parsed post objects
 * @param {number|null} viewerId - Current viewer ID (or null)
 * @param {string|null} viewerType - Current viewer type ('member'|'community'|null)
 * @param {Object} pool - PostgreSQL connection pool
 * @returns {Promise<Array<Object>>} Mutated posts array with hydrated fields
 */
async function hydratePostInteractions(posts, viewerId, viewerType, pool) {
  if (!Array.isArray(posts) || posts.length === 0) {
    return posts;
  }

  // 1. Group posts by interactive post_type
  const pollPosts = [];
  const promptPosts = [];
  const qnaPosts = [];
  const challengePosts = [];

  for (const post of posts) {
    const type = post.post_type;
    if (type === 'poll') pollPosts.push(post);
    else if (type === 'prompt') promptPosts.push(post);
    else if (type === 'qna') qnaPosts.push(post);
    else if (type === 'challenge') challengePosts.push(post);
  }

  // ── 2. Batched POLL Hydration ───────────────────────────────────────────────
  if (pollPosts.length > 0) {
    if (viewerId && viewerType) {
      try {
        const pollIds = pollPosts.map((p) => p.id);
        const voteResult = await pool.query(
          `SELECT post_id, option_index 
           FROM poll_votes 
           WHERE post_id = ANY($1::bigint[]) AND voter_id = $2 AND voter_type = $3`,
          [pollIds, viewerId, viewerType]
        );

        const votesByPost = new Map();
        for (const row of voteResult.rows) {
          const key = String(row.post_id);
          if (!votesByPost.has(key)) {
            votesByPost.set(key, []);
          }
          votesByPost.get(key).push(row.option_index);
        }

        for (const post of pollPosts) {
          const indexes = votesByPost.get(String(post.id)) || [];
          post.has_voted = indexes.length > 0;
          post.voted_indexes = indexes;
        }
      } catch (err) {
        console.error('[hydratePostInteractions] Poll batch error:', err.message || err);
        for (const post of pollPosts) {
          post.has_voted = false;
          post.voted_indexes = [];
        }
      }
    } else {
      for (const post of pollPosts) {
        post.has_voted = false;
        post.voted_indexes = [];
      }
    }
  }

  // ── 3. Batched PROMPT Hydration ─────────────────────────────────────────────
  if (promptPosts.length > 0) {
    const promptIds = promptPosts.map((p) => p.id);

    try {
      // 3a. Batched Counts: Submission count & total reply count
      const countsResult = await pool.query(
        `SELECT 
           p.id as post_id,
           COALESCE(sub_counts.cnt, 0)::int as submission_count,
           COALESCE(rep_counts.cnt, 0)::int as total_reply_count
         FROM UNNEST($1::bigint[]) AS p(id)
         LEFT JOIN (
           SELECT post_id, COUNT(*) as cnt
           FROM prompt_submissions
           WHERE post_id = ANY($1::bigint[])
           GROUP BY post_id
         ) sub_counts ON sub_counts.post_id = p.id
         LEFT JOIN (
           SELECT ps.post_id, COUNT(*) as cnt
           FROM prompt_replies pr
           JOIN prompt_submissions ps ON pr.submission_id = ps.id
           WHERE ps.post_id = ANY($1::bigint[]) AND ps.status = 'approved'
           GROUP BY ps.post_id
         ) rep_counts ON rep_counts.post_id = p.id`,
        [promptIds]
      );

      const countsByPost = new Map();
      for (const row of countsResult.rows) {
        countsByPost.set(String(row.post_id), {
          submission_count: parseInt(row.submission_count || 0),
          total_reply_count: parseInt(row.total_reply_count || 0),
        });
      }

      for (const post of promptPosts) {
        const counts = countsByPost.get(String(post.id)) || { submission_count: 0, total_reply_count: 0 };
        post.type_data = {
          ...post.type_data,
          submission_count: counts.submission_count,
          total_reply_count: counts.total_reply_count,
        };
      }
    } catch (err) {
      console.error('[hydratePostInteractions] Prompt counts batch error:', err.message || err);
      for (const post of promptPosts) {
        post.type_data = {
          ...post.type_data,
          submission_count: 0,
          total_reply_count: 0,
        };
      }
    }

    // 3b. Batched User Submissions (Pending, Approved, Rejected)
    if (viewerId && viewerType) {
      try {
        const userSubsResult = await pool.query(
          `SELECT post_id, id, status 
           FROM prompt_submissions 
           WHERE post_id = ANY($1::bigint[]) AND author_id = $2 AND author_type = $3`,
          [promptIds, viewerId, viewerType]
        );

        const subsByPost = new Map();
        for (const row of userSubsResult.rows) {
          const key = String(row.post_id);
          if (!subsByPost.has(key)) {
            subsByPost.set(key, []);
          }
          subsByPost.get(key).push(row);
        }

        for (const post of promptPosts) {
          const userSubs = subsByPost.get(String(post.id)) || [];
          const activeSub = userSubs.find((s) => s.status === 'pending' || s.status === 'approved');

          if (activeSub) {
            post.has_submitted = true;
            post.submission_status = activeSub.status;
          } else {
            post.has_submitted = false;
            const rejectedSub = userSubs.find((s) => s.status === 'rejected');
            post.submission_status = rejectedSub ? 'rejected' : null;
          }
        }
      } catch (err) {
        console.error('[hydratePostInteractions] Prompt user submission batch error:', err.message || err);
        for (const post of promptPosts) {
          post.has_submitted = false;
          post.submission_status = null;
        }
      }
    } else {
      for (const post of promptPosts) {
        post.has_submitted = false;
        post.submission_status = null;
      }
    }

    // 3c. Batched Preview Submission (Pinned first, then latest approved)
    try {
      const previewResult = await pool.query(
        `SELECT DISTINCT ON (s.post_id)
           s.post_id,
           s.id, s.content, s.created_at, s.status, s.is_pinned, s.reply_count,
           CASE 
             WHEN s.author_type = 'member' THEN m.name
             WHEN s.author_type = 'community' THEN c.name
             WHEN s.author_type = 'sponsor' THEN sp.brand_name
           END as author_name,
           CASE 
             WHEN s.author_type = 'member' THEN m.profile_photo_url
             WHEN s.author_type = 'community' THEN c.logo_url
             WHEN s.author_type = 'sponsor' THEN sp.logo_url
           END as author_photo_url
         FROM prompt_submissions s
         LEFT JOIN members m ON s.author_type = 'member' AND s.author_id = m.id
         LEFT JOIN communities c ON s.author_type = 'community' AND s.author_id = c.id
         LEFT JOIN sponsors sp ON s.author_type = 'sponsor' AND s.author_id = sp.id
         WHERE s.post_id = ANY($1::bigint[]) AND s.status = 'approved'
         ORDER BY 
           s.post_id,
           s.is_pinned DESC,
           s.created_at DESC`,
        [promptIds]
      );

      const previewsByPost = new Map();
      for (const row of previewResult.rows) {
        previewsByPost.set(String(row.post_id), {
          id: row.id,
          content: row.content,
          created_at: row.created_at,
          status: row.status,
          is_pinned: row.is_pinned,
          reply_count: row.reply_count,
          author_name: row.author_name,
          author_photo_url: row.author_photo_url,
        });
      }

      for (const post of promptPosts) {
        post.preview_submission = previewsByPost.get(String(post.id)) || null;
      }
    } catch (err) {
      console.error('[hydratePostInteractions] Prompt preview batch error:', err.message || err);
      for (const post of promptPosts) {
        post.preview_submission = null;
      }
    }
  }

  // ── 4. Batched Q&A Hydration ────────────────────────────────────────────────
  if (qnaPosts.length > 0) {
    const qnaIds = qnaPosts.map((p) => p.id);

    // 4a. Batched Counts & User Question Counts
    try {
      const countsResult = await pool.query(
        `SELECT 
           p.id as post_id,
           COALESCE(q_counts.question_count, 0)::int as question_count,
           COALESCE(q_counts.answered_count, 0)::int as answered_count,
           COALESCE(u_counts.user_question_count, 0)::int as user_question_count
         FROM UNNEST($1::bigint[]) AS p(id)
         LEFT JOIN (
           SELECT 
             post_id,
             COUNT(*) as question_count,
             COUNT(*) FILTER (WHERE answered_at IS NOT NULL) as answered_count
           FROM qna_questions 
           WHERE post_id = ANY($1::bigint[]) AND is_hidden = false
           GROUP BY post_id
         ) q_counts ON q_counts.post_id = p.id
         LEFT JOIN (
           SELECT 
             post_id,
             COUNT(*) as user_question_count
           FROM qna_questions
           WHERE post_id = ANY($1::bigint[])
             AND author_id = $2 AND author_type = $3
           GROUP BY post_id
         ) u_counts ON u_counts.post_id = p.id`,
        [qnaIds, viewerId || null, viewerType || null]
      );

      const countsByPost = new Map();
      for (const row of countsResult.rows) {
        countsByPost.set(String(row.post_id), {
          question_count: parseInt(row.question_count || 0),
          answered_count: parseInt(row.answered_count || 0),
          user_question_count: parseInt(row.user_question_count || 0),
        });
      }

      for (const post of qnaPosts) {
        const counts = countsByPost.get(String(post.id)) || { question_count: 0, answered_count: 0, user_question_count: 0 };
        post.type_data = {
          ...post.type_data,
          question_count: counts.question_count,
          answered_count: counts.answered_count,
        };
        post.user_question_count = viewerId && viewerType ? counts.user_question_count : 0;
      }
    } catch (err) {
      console.error('[hydratePostInteractions] QnA counts batch error:', err.message || err);
      for (const post of qnaPosts) {
        post.type_data = {
          ...post.type_data,
          question_count: 0,
          answered_count: 0,
        };
        post.user_question_count = 0;
      }
    }

    // 4b. Batched Preview Question
    try {
      const previewResult = await pool.query(
        `SELECT DISTINCT ON (q.post_id)
           q.post_id,
           q.id, q.question as content, q.upvote_count, q.is_pinned,
           q.is_anonymous,
           q.answered_at IS NOT NULL as is_answered,
           CASE 
             WHEN $2::int IS NOT NULL AND $3::text IS NOT NULL THEN EXISTS (
               SELECT 1 FROM qna_question_upvotes u
               WHERE u.question_id = q.id AND u.voter_id = $2 AND u.voter_type = $3
             )
             ELSE false
           END as has_upvoted,
           CASE 
             WHEN q.is_anonymous THEN NULL
             WHEN q.author_type = 'member' THEN m.name
             WHEN q.author_type = 'community' THEN c.name
           END as author_name,
           CASE 
             WHEN q.is_anonymous THEN NULL
             WHEN q.author_type = 'member' THEN m.username
             WHEN q.author_type = 'community' THEN c.username
           END as author_username,
           CASE 
             WHEN q.is_anonymous THEN NULL
             WHEN q.author_type = 'member' THEN m.profile_photo_url
             WHEN q.author_type = 'community' THEN c.logo_url
           END as author_photo_url
         FROM qna_questions q
         LEFT JOIN members m ON q.author_type = 'member' AND q.author_id = m.id
         LEFT JOIN communities c ON q.author_type = 'community' AND q.author_id = c.id
         WHERE q.post_id = ANY($1::bigint[]) AND q.is_hidden = false
         ORDER BY q.post_id, q.is_pinned DESC, q.upvote_count DESC, q.created_at DESC`,
        [qnaIds, viewerId || null, viewerType || null]
      );

      const previewsByPost = new Map();
      for (const row of previewResult.rows) {
        previewsByPost.set(String(row.post_id), {
          id: row.id,
          content: row.content,
          upvote_count: row.upvote_count,
          is_pinned: row.is_pinned,
          is_anonymous: row.is_anonymous,
          is_answered: row.is_answered,
          has_upvoted: row.has_upvoted,
          author_name: row.author_name,
          author_username: row.author_username,
          author_photo_url: row.author_photo_url,
        });
      }

      for (const post of qnaPosts) {
        post.preview_question = previewsByPost.get(String(post.id)) || null;
      }
    } catch (err) {
      console.error('[hydratePostInteractions] QnA preview batch error:', err.message || err);
      for (const post of qnaPosts) {
        post.preview_question = null;
      }
    }
  }

  // ── 5. Batched CHALLENGE Hydration ──────────────────────────────────────────
  if (challengePosts.length > 0) {
    const challengeIds = challengePosts.map((p) => p.id);

    // 5a. Batched Counts: Participant & Completed counts
    try {
      const countsResult = await pool.query(
        `SELECT 
           post_id,
           COUNT(*)::int as participant_count,
           COUNT(*) FILTER (WHERE status = 'completed')::int as completed_count
         FROM challenge_participations 
         WHERE post_id = ANY($1::bigint[])
         GROUP BY post_id`,
        [challengeIds]
      );

      const countsByPost = new Map();
      for (const row of countsResult.rows) {
        countsByPost.set(String(row.post_id), {
          participant_count: parseInt(row.participant_count || 0),
          completed_count: parseInt(row.completed_count || 0),
        });
      }

      for (const post of challengePosts) {
        const counts = countsByPost.get(String(post.id)) || { participant_count: 0, completed_count: 0 };
        post.type_data = {
          ...post.type_data,
          participant_count: counts.participant_count,
          completed_count: counts.completed_count,
        };
      }
    } catch (err) {
      console.error('[hydratePostInteractions] Challenge counts batch error:', err.message || err);
      for (const post of challengePosts) {
        post.type_data = {
          ...post.type_data,
          participant_count: 0,
          completed_count: 0,
        };
      }
    }

    // 5b. Batched User Participation & Submissions
    if (viewerId && viewerType) {
      try {
        const partResult = await pool.query(
          `SELECT 
             cp.post_id,
             cp.id, cp.status, cp.progress,
             COUNT(cs.id) FILTER (WHERE cs.status NOT IN ('rejected', 'withdrawn'))::int as user_submission_count,
             MAX(CASE WHEN cs.status NOT IN ('rejected', 'withdrawn') THEN 
               CASE WHEN cs.is_featured THEN 'featured' ELSE cs.status END 
             END) as top_status
           FROM challenge_participations cp
           LEFT JOIN challenge_submissions cs ON cs.participant_id = cp.id
           WHERE cp.post_id = ANY($1::bigint[]) AND cp.participant_id = $2 AND cp.participant_type = $3
           GROUP BY cp.post_id, cp.id, cp.status, cp.progress`,
          [challengeIds, viewerId, viewerType]
        );

        const partByPost = new Map();
        for (const row of partResult.rows) {
          partByPost.set(String(row.post_id), row);
        }

        for (const post of challengePosts) {
          const row = partByPost.get(String(post.id));
          if (row) {
            post.has_joined = true;
            post.user_participation = {
              id: row.id,
              status: row.status,
              progress: row.progress,
            };
            post.user_submission_count = parseInt(row.user_submission_count || 0);
            post.user_submission_status = row.top_status || null;

            // Live progress calculation for progress challenges
            if (post.type_data?.challenge_type === 'progress' && post.user_participation) {
              const targetCount = parseInt(post.type_data.target_count) || 1;
              const liveProgress = Math.min(
                100,
                Math.round((post.user_submission_count / targetCount) * 100)
              );
              post.user_participation.progress = liveProgress;
            }
          } else {
            post.has_joined = false;
            post.user_participation = null;
            post.user_submission_count = 0;
            post.user_submission_status = null;
          }
        }
      } catch (err) {
        console.error('[hydratePostInteractions] Challenge user participation batch error:', err.message || err);
        for (const post of challengePosts) {
          post.has_joined = false;
          post.user_participation = null;
          post.user_submission_count = 0;
          post.user_submission_status = null;
        }
      }
    } else {
      for (const post of challengePosts) {
        post.has_joined = false;
        post.user_participation = null;
        post.user_submission_count = 0;
        post.user_submission_status = null;
      }
    }

    // 5c. Batched Featured Submission Preview
    try {
      const previewResult = await pool.query(
        `SELECT DISTINCT ON (cs.post_id)
           cs.post_id,
           cs.id, cs.content, cs.media_urls, cs.video_url, cs.video_thumbnail,
           cs.like_count, cs.is_featured,
           cp.participant_id, cp.participant_type,
           CASE 
             WHEN cp.participant_type = 'member' THEN m.name
             WHEN cp.participant_type = 'community' THEN c.name
           END as participant_name,
           CASE 
             WHEN cp.participant_type = 'member' THEN m.profile_photo_url
             WHEN cp.participant_type = 'community' THEN c.logo_url
           END as participant_photo_url
         FROM challenge_submissions cs
         JOIN challenge_participations cp ON cs.participant_id = cp.id
         LEFT JOIN members m ON cp.participant_type = 'member' AND cp.participant_id = m.id
         LEFT JOIN communities c ON cp.participant_type = 'community' AND cp.participant_id = c.id
         WHERE cs.post_id = ANY($1::bigint[]) AND cs.status = 'approved'
         ORDER BY cs.post_id, cs.is_featured DESC, cs.like_count DESC, cs.created_at DESC`,
        [challengeIds]
      );

      const previewsByPost = new Map();
      for (const row of previewResult.rows) {
        previewsByPost.set(String(row.post_id), {
          id: row.id,
          content: row.content,
          media_urls: (() => {
            try {
              if (!row.media_urls) return [];
              if (Array.isArray(row.media_urls)) return row.media_urls;
              return JSON.parse(row.media_urls);
            } catch {
              return [];
            }
          })(),
          video_url: row.video_url,
          video_thumbnail: row.video_thumbnail,
          like_count: row.like_count,
          is_featured: row.is_featured,
          participant_id: row.participant_id,
          participant_type: row.participant_type,
          participant_name: row.participant_name,
          participant_photo_url: row.participant_photo_url,
        });
      }

      for (const post of challengePosts) {
        post.preview_submission = previewsByPost.get(String(post.id)) || null;
      }
    } catch (err) {
      console.error('[hydratePostInteractions] Challenge preview batch error:', err.message || err);
      for (const post of challengePosts) {
        post.preview_submission = null;
      }
    }
  }

  return posts;
}

module.exports = {
  hydratePostInteractions,
};
