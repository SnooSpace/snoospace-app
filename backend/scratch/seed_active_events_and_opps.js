'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createPool } = require('../config/db');

async function seedActiveEventsAndOpps() {
  const pool = createPool();
  console.log('================================================================');
  console.log('🌱 Seeding Active Events & Opportunities (Extended 7-14 Days)');
  console.log('================================================================\n');

  try {
    // 1. Ensure clean discoverable communities exist
    const commsData = [
      { name: 'SnooSpace Community', username: 'snoospace', category: 'technology', bio: 'Official SnooSpace Community Hub' },
      { name: 'Tech & AI Guild', username: 'tech_ai_guild', category: 'technology', bio: 'AI researchers, builders & tech enthusiasts' },
      { name: 'UI/UX Design Craft', username: 'uiux_craft', category: 'design', bio: 'Product designers, UI/UX crafters & design leaders' },
      { name: 'Bangalore Founders Hub', username: 'founders_hub_blr', category: 'entrepreneurship', bio: 'Startup founders, angels & builders in BLR' },
    ];

    const communityIds = [];
    for (const c of commsData) {
      const existing = await pool.query(`SELECT id FROM communities WHERE username = $1`, [c.username]);
      if (existing.rows.length > 0) {
        communityIds.push(existing.rows[0].id);
      } else {
        const ins = await pool.query(`
          INSERT INTO communities (name, username, category, bio, created_at)
          VALUES ($1, $2, $3, $4, NOW())
          RETURNING id
        `, [c.name, c.username, c.category, c.bio]);
        communityIds.push(ins.rows[0].id);
      }
    }
    console.log(`✓ Active Communities for Events & Opps (${communityIds.length}):`, communityIds);

    // 2. Seed Active Opportunities (Expires in 7 to 14 days)
    const oppsToCreate = [
      {
        title: 'Lead React Native Mobile Developer',
        creator_id: String(communityIds[0]),
        creator_type: 'community',
        opportunity_types: ['Engineering', 'Mobile'],
        work_type: 'ongoing',
        work_mode: 'remote',
        experience_level: 'advanced',
        payment_nature: 'paid',
        payment_type: 'monthly',
        visibility: 'public',
        eligibility_mode: 'any_one',
        availability: 'Part-time',
        turnaround: 'Immediate',
        budget_range: '₹80,000 - ₹1,20,000/mo',
        about_role: 'Looking for a Senior React Native engineer to architect high-performance feed surfaces and animations.',
        responsibilities: ['Build smooth FlashList feed screens', 'Optimize bundle size & frame rate', 'Lead sprint reviews'],
        who_can_apply: ['3+ years React Native experience', 'Proficient in Reanimated & FlashList'],
        gains: ['Competitive compensation', 'High-visibility consumer product ownership'],
        status: 'active',
        daysValid: 10
      },
      {
        title: 'Product Designer (UI/UX & Design Systems)',
        creator_id: String(communityIds[2] || communityIds[0]),
        creator_type: 'community',
        opportunity_types: ['Design', 'UI/UX'],
        work_type: 'one_time',
        work_mode: 'hybrid',
        experience_level: 'intermediate',
        payment_nature: 'paid',
        payment_type: 'fixed',
        visibility: 'public',
        eligibility_mode: 'any_one',
        availability: 'Flexible',
        turnaround: 'Within 1 week',
        budget_range: '₹50,000 - ₹75,000/project',
        about_role: 'Craft delightful typography-first card components, micro-animations, and interactive modals.',
        responsibilities: ['Design Figma component tokens', 'Build interactive prototypes', 'Iterate on user feedback'],
        who_can_apply: ['Strong visual & interaction portfolio', 'Experience with mobile design patterns'],
        gains: ['Portfolio showcase piece', 'Direct founder collaboration'],
        status: 'active',
        daysValid: 12
      },
      {
        title: 'Technical Community Growth Lead',
        creator_id: String(communityIds[1] || communityIds[0]),
        creator_type: 'community',
        opportunity_types: ['Marketing', 'Community'],
        work_type: 'ongoing',
        work_mode: 'remote',
        experience_level: 'any',
        payment_nature: 'paid',
        payment_type: 'monthly',
        visibility: 'public',
        eligibility_mode: 'any_one',
        availability: '10 hrs/week',
        turnaround: 'Immediate',
        budget_range: '₹30,000 - ₹45,000/mo',
        about_role: 'Host developer challenges, manage tech Discord channels, and curate weekly tech prompts.',
        responsibilities: ['Organize bi-weekly tech AMAs', 'Engage builder community', 'Track weekly metrics'],
        who_can_apply: ['Active community builder', 'Strong written communication'],
        gains: ['Networking with top founders', 'Flexible hours'],
        status: 'active',
        daysValid: 14
      },
      {
        title: 'Full-Stack Node.js & PostgreSQL Architect',
        creator_id: String(communityIds[3] || communityIds[0]),
        creator_type: 'community',
        opportunity_types: ['Engineering', 'Backend'],
        work_type: 'ongoing',
        work_mode: 'remote',
        experience_level: 'advanced',
        payment_nature: 'paid',
        payment_type: 'monthly',
        visibility: 'public',
        eligibility_mode: 'any_one',
        availability: '20 hrs/week',
        turnaround: 'Immediate',
        budget_range: '₹90,000 - ₹1,40,000/mo',
        about_role: 'Optimize SQL CTEs, indexing, and Redis caching for feed ranking and impression scoring.',
        responsibilities: ['Refactor heavy backend queries', 'Implement DB partitions & indexing', 'Write automated test suites'],
        who_can_apply: ['Strong PostgreSQL & Node.js background', 'Experience scaling feed architectures'],
        gains: ['Challenging high-scale engineering work', 'Top market pay'],
        status: 'active',
        daysValid: 9
      },
      {
        title: 'Video Content Creator & Visual Storyteller',
        creator_id: String(communityIds[0]),
        creator_type: 'community',
        opportunity_types: ['Creative', 'Video'],
        work_type: 'one_time',
        work_mode: 'remote',
        experience_level: 'intermediate',
        payment_nature: 'paid',
        payment_type: 'per_deliverable',
        visibility: 'public',
        eligibility_mode: 'any_one',
        availability: 'Project-based',
        turnaround: '2 weeks',
        budget_range: '₹25,000 - ₹40,000/video',
        about_role: 'Produce engaging cinematic short-form videos and demo walkthroughs for upcoming feature drops.',
        responsibilities: ['Script, shoot, and edit 60s product clips', 'Add motion graphics and sound design'],
        who_can_apply: ['Proficient in Premiere / After Effects / DaVinci', 'Eye for clean aesthetics'],
        gains: ['Featured on primary social channels', 'Ongoing retainers'],
        status: 'active',
        daysValid: 14
      }
    ];

    const insertedOpps = [];
    for (const opp of oppsToCreate) {
      const ins = await pool.query(`
        INSERT INTO opportunities (
          id, title, creator_id, creator_type, opportunity_types,
          work_type, work_mode, experience_level, payment_nature, payment_type,
          visibility, eligibility_mode, availability, turnaround, budget_range,
          about_role, responsibilities, who_can_apply, gains, status,
          created_at, updated_at, expires_at, applicant_count, like_count,
          view_count, comment_count, share_count, save_count
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4,
          $5, $6, $7, $8, $9,
          $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19,
          NOW(), NOW(), NOW() + ($20 || ' days')::interval, 0, 0,
          0, 0, 0, 0
        ) RETURNING id, title, expires_at, status
      `, [
        opp.title, opp.creator_id, opp.creator_type, opp.opportunity_types,
        opp.work_type, opp.work_mode, opp.experience_level, opp.payment_nature, opp.payment_type,
        opp.visibility, opp.eligibility_mode, opp.availability, opp.turnaround, opp.budget_range,
        opp.about_role, opp.responsibilities, opp.who_can_apply, opp.gains, opp.status,
        opp.daysValid
      ]);
      insertedOpps.push(ins.rows[0]);
    }
    console.log(`\n✓ Successfully Seeded ${insertedOpps.length} Active Opportunities (Valid for 9-14 days):`);
    insertedOpps.forEach(o => console.log(`   - [ID ${o.id}] "${o.title}" (Expires: ${new Date(o.expires_at).toISOString().slice(0, 10)})`));

    // 3. Seed Active Events (Scheduled 3 to 10 days in the future)
    const eventsToCreate = [
      {
        community_id: communityIds[0],
        title: 'SnooSpace Engineering & AI Summit 2026',
        description: 'Deep dive into next-gen mobile architecture, on-device AI models, and real-time feed optimization.',
        location_name: 'Indiranagar Social, Bangalore',
        daysFromNow: 4,
        durationHours: 4,
        ticket_price: 0,
        categories: ['Technology', 'AI', 'Mobile'],
        banner_url: 'https://res.cloudinary.com/dulhurgt7/image/upload/v1781683463/snoospace/community-voice/xsoyfr5cyll3ha4rspdg.png'
      },
      {
        community_id: communityIds[1] || communityIds[0],
        title: 'Bangalore Founders & Angel Networking Mixer',
        description: 'Connect with 100+ active founders, early-stage operators, and angel investors over coffee and pitch sessions.',
        location_name: 'WeWork Galaxy, Residency Road, BLR',
        daysFromNow: 6,
        durationHours: 3,
        ticket_price: 499,
        categories: ['Startup', 'Networking', 'Founders'],
        banner_url: 'https://res.cloudinary.com/dulhurgt7/image/upload/v1781683502/snoospace/community-voice/reuwmkly0h9fvul9lzqg.png'
      },
      {
        community_id: communityIds[2] || communityIds[0],
        title: 'UI/UX Design Systems Sprint: Zero to Production',
        description: 'Hands-on interactive workshop on building scalable design tokens, micro-interactions, and accessible typography.',
        location_name: 'Koramangala 4th Block, Bangalore',
        daysFromNow: 8,
        durationHours: 5,
        ticket_price: 0,
        categories: ['Design', 'UI/UX', 'Workshop'],
        banner_url: 'https://res.cloudinary.com/dulhurgt7/image/upload/v1781683463/snoospace/community-voice/xsoyfr5cyll3ha4rspdg.png'
      },
      {
        community_id: communityIds[3] || communityIds[0],
        title: 'Open Source Hacknight: Real-Time Mobile Feeds',
        description: 'Pair program, benchmark FlashList scroll performance, and contribute to open-source developer tooling.',
        location_name: 'Church Street, Bangalore',
        daysFromNow: 11,
        durationHours: 6,
        ticket_price: 0,
        categories: ['Hackathon', 'OpenSource', 'Code'],
        banner_url: 'https://res.cloudinary.com/dulhurgt7/image/upload/v1781683502/snoospace/community-voice/reuwmkly0h9fvul9lzqg.png'
      }
    ];

    const insertedEvents = [];
    for (const ev of eventsToCreate) {
      const ins = await pool.query(`
        INSERT INTO events (
          community_id, title, description, location_name,
          event_date, start_datetime, end_datetime,
          is_published, is_cancelled, access_type, invite_public_visibility,
          ticket_price, categories, banner_url, created_at,
          like_count, comment_count, view_count, share_count
        ) VALUES (
          $1, $2, $3, $4,
          NOW() + ($5 || ' days')::interval,
          NOW() + ($5 || ' days')::interval,
          NOW() + ($5 || ' days')::interval + ($6 || ' hours')::interval,
          true, false, 'public', true,
          $7, $8, $9, NOW(),
          0, 0, 0, 0
        ) RETURNING id, title, start_datetime, end_datetime, is_published
      `, [
        ev.community_id, ev.title, ev.description, ev.location_name,
        ev.daysFromNow, ev.durationHours, ev.ticket_price, ev.categories,
        ev.banner_url
      ]);

      const eventRow = ins.rows[0];
      insertedEvents.push(eventRow);

      // Add banner into event_banners
      await pool.query(`
        INSERT INTO event_banners (event_id, image_url, image_order, created_at)
        VALUES ($1, $2, 0, NOW())
      `, [eventRow.id, ev.banner_url]);
    }
    console.log(`\n✓ Successfully Seeded ${insertedEvents.length} Active Events (Scheduled 4-11 days ahead):`);
    insertedEvents.forEach(e => console.log(`   - [ID ${e.id}] "${e.title}" (Start: ${new Date(e.start_datetime).toISOString().slice(0, 10)})`));

    console.log('\n════════════════════════════════════════════════════════════════');
    console.log('✅ ALL ACTIVE EVENTS & OPPORTUNITIES SEEDED SUCCESSFULLY!');
    console.log('════════════════════════════════════════════════════════════════\n');

  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedActiveEventsAndOpps();
