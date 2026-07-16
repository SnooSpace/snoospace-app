const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: parseInt(process.env.DB_PORT, 10),
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function diagnose() {
  // 1. Show the plan raw
  const planR = await pool.query(`SELECT id, title, status, visibility, gender_preference, scheduled_at, expires_at, created_by FROM open_plans WHERE status = 'active' ORDER BY created_at DESC LIMIT 10`);
  console.log('\n=== Active Plans ===');
  planR.rows.forEach(p => {
    const now = new Date();
    const expired = new Date(p.expires_at) <= now;
    console.log(`[${p.id}] "${p.title}"`);
    console.log(`  status=${p.status} | visibility=${p.visibility} | gender_pref=${p.gender_preference}`);
    console.log(`  scheduled_at=${p.scheduled_at} | expires_at=${p.expires_at}`);
    console.log(`  created_by=${p.created_by} | EXPIRED NOW? ${expired}`);
  });

  // 2. Check gender of all members
  const membersR = await pool.query(`SELECT id, name, gender FROM members ORDER BY id`);
  console.log('\n=== Members & their gender ===');
  membersR.rows.forEach(m => console.log(`  [${m.id}] ${m.name} | gender=${m.gender}`));

  // 3. For each plan, check which members can see it and which filter blocks them
  for (const plan of planR.rows) {
    console.log(`\n=== Visibility check for plan [${plan.id}] "${plan.title}" (visibility=${plan.visibility}, gender_pref=${plan.gender_preference}) ===`);
    for (const member of membersR.rows) {
      if (String(member.id) === String(plan.created_by)) {
        console.log(`  [${member.id}] ${member.name}: OWNER (skipping)`);
        continue;
      }

      // expires_at check
      if (new Date(plan.expires_at) <= new Date()) {
        console.log(`  [${member.id}] ${member.name}: BLOCKED by expires_at`);
        continue;
      }

      // gender check
      if (plan.gender_preference !== 'all' && plan.gender_preference !== member.gender) {
        console.log(`  [${member.id}] ${member.name}: BLOCKED by gender_preference (plan wants ${plan.gender_preference}, member is ${member.gender})`);
        continue;
      }

      // visibility check
      if (plan.visibility === 'everyone') {
        console.log(`  [${member.id}] ${member.name}: VISIBLE (visibility=everyone)`);
        continue;
      }

      if (plan.visibility === 'community_members') {
        const sharedR = await pool.query(
          `SELECT c.id, c.name FROM follows f1
           JOIN follows f2 ON f1.following_id = f2.following_id AND f1.following_type = 'community' AND f2.following_type = 'community'
           JOIN communities c ON c.id = f1.following_id
           WHERE f1.follower_id = $1 AND f1.follower_type = 'member'
             AND f2.follower_id = $2 AND f2.follower_type = 'member'`,
          [member.id, plan.created_by]
        );
        if (sharedR.rows.length > 0) {
          console.log(`  [${member.id}] ${member.name}: VISIBLE (shared communities: ${sharedR.rows.map(c => c.name).join(', ')})`);
        } else {
          console.log(`  [${member.id}] ${member.name}: BLOCKED by community_members visibility (no shared community with creator ${plan.created_by})`);
        }
      }
    }
  }

  await pool.end();
}

diagnose().catch(e => { console.error(e.message); pool.end(); });
