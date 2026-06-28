require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createPool } = require('../config/db');
const p = createPool();

const colChecks = [
  ['user_aqi_signals', ['device_platform','device_brand','device_model_raw','device_tier','total_rsvps','total_attended','return_frequency_score','session_depth_score','consecutive_paid_no_shows','total_paid_no_shows']],
  ['sessions', ['platform','os_version','device_model','device_brand','device_tier']],
  ['events', ['slug','timezone','creator_type','category','status','banner_images','city','latitude','longitude']],
  ['communities', ['user_id']],
  ['community_heads', ['title','description','display_order','show_on_profile']],
  ['conversation_reports', ['admin_note','reviewed_at','resolved_at','resolution_note','resolved_by']],
  ['opportunities', ['expires_at','is_pinned','view_count','like_count','comment_count','share_count','save_count','requires_resume']],
  ['challenge_submissions', ['view_count','share_count']],
];

const tableChecks = [
  'challenge_submission_comments','challenge_submission_views','comment_likes',
  'opportunity_comments','opportunity_likes','opportunity_saves','opportunity_views','opportunity_comment_likes',
  'community_categories','location_hierarchy','user_aqi_signals','follow_events','user_interest_vectors',
  'user_behavior_events','razorpay_payments','community_fraud_signals','community_health_scores',
  'member_profile_change_log','event_quality_scores','aqi_sessions','aqi_session_stats',
  'ticket_types','ticket_gifts','ticket_reservations','event_banners','event_cohosts','event_views',
  'open_plans','open_plan_comments','open_plan_likes','signup_interests','circles','circle_requests',
  'discover_categories','branches','pronouns','reports','user_bans','user_blocks','conversation_reports',
  'pricing_rules','discount_codes','registration_tickets','poll_votes','prompt_submissions',
  'qna_questions','qna_answers','challenge_participations','challenge_submissions'
];

async function go() {
  console.log('=== COLUMN CHECKS ===');
  for (const [table, cols] of colChecks) {
    const q = 'SELECT column_name FROM information_schema.columns WHERE table_schema=\'public\' AND table_name=\'' + table + '\' AND column_name IN (' + cols.map(c => '\'' + c + '\'').join(',') + ')';
    const res = await p.query(q);
    const found = res.rows.map(r => r.column_name);
    const missing = cols.filter(c => !found.includes(c));
    if (missing.length > 0) console.log('MISSING in ' + table + ': ' + missing.join(', '));
    else console.log('OK ' + table + ' (' + cols.length + ' cols)');
  }
  
  console.log('\n=== TABLE EXISTENCE ===');
  const tRes = await p.query('SELECT tablename FROM pg_tables WHERE schemaname=\'public\'');
  const existing = new Set(tRes.rows.map(r => r.tablename));
  tableChecks.forEach(t => {
    if (!existing.has(t)) console.log('MISSING TABLE: ' + t);
    else console.log('TABLE OK: ' + t);
  });

  console.log('\n=== ROW COUNTS (sanity check) ===');
  const countTables = ['members','communities','events','user_aqi_signals','sessions','posts','notifications','follows','event_registrations'];
  for (const t of countTables) {
    try {
      const r = await p.query('SELECT COUNT(*) AS cnt FROM ' + t);
      console.log(t + ': ' + r.rows[0].cnt + ' rows');
    } catch(e) {
      console.log(t + ': ERROR - ' + e.message);
    }
  }
  
  await p.end();
}
go().catch(e => { console.error(e.message); p.end(); });
