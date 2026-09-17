'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createPool } = require('../config/db');

// Calculate upcoming weekend dates
function getUpcomingWeekendDates() {
  const now = new Date();
  const currentDay = now.getDay(); // 0: Sun, 1: Mon, ... 6: Sat
  
  const friday = new Date(now);
  friday.setDate(now.getDate() - currentDay + 5);
  friday.setHours(22, 0, 0, 0);

  const saturdayMorning = new Date(now);
  saturdayMorning.setDate(now.getDate() - currentDay + 6);
  saturdayMorning.setHours(6, 30, 0, 0);

  const saturdayAfternoon = new Date(now);
  saturdayAfternoon.setDate(now.getDate() - currentDay + 6);
  saturdayAfternoon.setHours(15, 0, 0, 0);

  const sundayMorning = new Date(now);
  sundayMorning.setDate(now.getDate() - currentDay + 7);
  sundayMorning.setHours(10, 30, 0, 0);

  const saturdayNightCamp = new Date(now);
  saturdayNightCamp.setDate(now.getDate() - currentDay + 6);
  saturdayNightCamp.setHours(16, 0, 0, 0);

  if (now > sundayMorning) {
    friday.setDate(friday.getDate() + 7);
    saturdayMorning.setDate(saturdayMorning.getDate() + 7);
    saturdayAfternoon.setDate(saturdayAfternoon.getDate() + 7);
    sundayMorning.setDate(sundayMorning.getDate() + 7);
    saturdayNightCamp.setDate(saturdayNightCamp.getDate() + 7);
  }

  return {
    friday,
    saturdayMorning,
    saturdayAfternoon,
    sundayMorning,
    saturdayNightCamp
  };
}

async function seedMarketingExploreFeed() {
  const pool = createPool();
  console.log('================================================================');
  console.log('🌟 Seeding High-Aesthetic Marketing Dataset for SnooSpace Explore');
  console.log('================================================================\n');

  try {
    // 1. Wipe old test events and related tables cleanly
    console.log('🧹 1. Cleaning existing test events and related tables...');
    await pool.query(`DELETE FROM curated_list_events`);
    await pool.query(`DELETE FROM curated_lists`);
    await pool.query(`DELETE FROM event_postponement_decisions`);
    await pool.query(`DELETE FROM event_repeat_view_events`);
    await pool.query(`DELETE FROM event_payouts`);
    await pool.query(`DELETE FROM refund_requests`);
    await pool.query(`DELETE FROM event_discover_categories`);
    await pool.query(`DELETE FROM event_cohosts`);
    await pool.query(`DELETE FROM event_reviews`);
    await pool.query(`DELETE FROM event_impression_state`);
    await pool.query(`DELETE FROM event_verifications`);
    await pool.query(`DELETE FROM opportunities`);
    await pool.query(`DELETE FROM connection_requests`);
    await pool.query(`DELETE FROM profile_views`);
    await pool.query(`DELETE FROM event_comments`);
    await pool.query(`DELETE FROM event_likes`);
    await pool.query(`DELETE FROM event_views`);
    await pool.query(`DELETE FROM next_event_requests`);
    await pool.query(`DELETE FROM event_matches`);
    await pool.query(`DELETE FROM event_swipes`);
    await pool.query(`DELETE FROM invite_requests`);
    await pool.query(`DELETE FROM ticket_reservations`);
    await pool.query(`DELETE FROM ticket_gifts`);
    await pool.query(`DELETE FROM pricing_rules`);
    await pool.query(`DELETE FROM discount_codes`);
    await pool.query(`DELETE FROM ticket_types`);
    await pool.query(`DELETE FROM event_registrations`);
    await pool.query(`DELETE FROM event_gallery`);
    await pool.query(`DELETE FROM event_banners`);
    await pool.query(`DELETE FROM event_interests`);
    await pool.query(`DELETE FROM event_featured_accounts`);
    await pool.query(`DELETE FROM event_things_to_know`);
    await pool.query(`DELETE FROM event_highlights`);
    await pool.query(`DELETE FROM events`);
    console.log('✓ Cleaned all prior test events.\n');

    // 2. Ensure Organizer Communities exist and are approved
    console.log('🏢 2. Ensuring Organizer Communities exist...');
    const communitiesConfig = [
      { username: 'snoospace', name: 'SnooSpace', category: 'Technology' },
      { username: 'founders_hub_blr', name: 'Bangalore Founders Hub', category: 'Entrepreneurship' },
      { username: 'tech_ai_guild', name: 'Tech & AI Guild', category: 'Technology' },
      { username: 'uiux_craft', name: 'UI/UX Design Craft', category: 'Design' },
      { username: 'blr_music_collective', name: 'Bangalore Electronic Music Collective', category: 'Music' },
      { username: 'culinary_blr', name: 'Bangalore Culinary Explorers', category: 'Food & Dining' },
      { username: 'urban_fit_blr', name: 'Urban Fitness & Run Society', category: 'Fitness' },
      { username: 'adventure_ghats', name: 'Western Ghats Trekking & Adventure', category: 'Outdoors' },
      { username: 'boardgame_esports_blr', name: 'Bangalore Board Game & Esports Club', category: 'Gaming' },
      { username: 'clay_pottery_blr', name: 'Artisan Clay & Pottery Studio', category: 'Arts & Culture' },
    ];

    const communityIdMap = new Map();
    for (const c of communitiesConfig) {
      const existing = await pool.query(`SELECT id FROM communities WHERE username = $1`, [c.username]);
      if (existing.rows.length > 0) {
        communityIdMap.set(c.username, existing.rows[0].id);
        await pool.query(`UPDATE communities SET verification_status = 'approved', name = $1, category = $2 WHERE id = $3`, [c.name, c.category, existing.rows[0].id]);
      } else {
        const ins = await pool.query(`
          INSERT INTO communities (name, username, category, verification_status, created_at)
          VALUES ($1, $2, $3, 'approved', NOW())
          RETURNING id
        `, [c.name, c.username, c.category]);
        communityIdMap.set(c.username, ins.rows[0].id);
      }
    }
    console.log(`✓ Confirmed ${communityIdMap.size} Organizer Communities.\n`);

    // 3. Ensure Demo Attendee Members for Avatar Stacks
    console.log('👥 3. Ensuring Demo Attendee Members with Profile Photos...');
    const demoMembers = [
      { username: 'maya_p', name: 'Maya Patel', gender: 'Female', photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80' },
      { username: 'rohan_m', name: 'Rohan Mehta', gender: 'Male', photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80' },
      { username: 'ananya_s', name: 'Ananya Sharma', gender: 'Female', photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80' },
      { username: 'arjun_n', name: 'Arjun Nair', gender: 'Male', photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80' },
      { username: 'kabir_v', name: 'Kabir Verma', gender: 'Male', photo: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=150&q=80' },
      { username: 'priya_r', name: 'Priya Rao', gender: 'Female', photo: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80' }
    ];

    const demoAttendeeIds = [];
    for (let i = 0; i < demoMembers.length; i++) {
      const m = demoMembers[i];
      const existing = await pool.query(`SELECT id FROM members WHERE username = $1`, [m.username]);
      if (existing.rows.length > 0) {
        await pool.query(`UPDATE members SET profile_photo_url = $1, name = $2 WHERE id = $3`, [m.photo, m.name, existing.rows[0].id]);
        demoAttendeeIds.push(existing.rows[0].id);
      } else {
        const email = `${m.username}@snoospace.com`;
        const phone = `98000000${String(i).padStart(2, '0')}`;
        const ins = await pool.query(`
          INSERT INTO members (name, username, email, phone, dob, gender, interests, profile_photo_url, created_at, signup_status)
          VALUES ($1, $2, $3, $4, '2000-01-01', $5, '["Technology", "Music", "Design"]'::jsonb, $6, NOW(), 'completed')
          RETURNING id
        `, [m.name, m.username, email, phone, m.gender, m.photo]);
        demoAttendeeIds.push(ins.rows[0].id);
      }
    }
    console.log(`✓ Prepared ${demoAttendeeIds.length} Demo Attendees for Avatar Stacks.\n`);

    // 4. Ensure Categories in discover_categories
    console.log('🏷️  4. Ensuring Top-Level Discover Categories...');
    const categoriesToEnsure = [
      { slug: 'tech-startup', name: 'Tech & Startup', iconName: 'code', order: 1 },
      { slug: 'food-dining', name: 'Food & Dining', iconName: 'utensils-crossed', order: 2 },
      { slug: 'music', name: 'Music', iconName: 'music', order: 3 },
      { slug: 'outdoors-adventure', name: 'Outdoors & Adventure', iconName: 'tent', order: 4 },
      { slug: 'arts-culture', name: 'Arts & Culture', iconName: 'palette', order: 5 },
      { slug: 'sports-fitness', name: 'Sports & Fitness', iconName: 'heart-pulse', order: 6 },
      { slug: 'nightlife-parties', name: 'Nightlife & Parties', iconName: 'martini', order: 7 },
      { slug: 'gaming-esports', name: 'Gaming & Esports', iconName: 'gamepad-2', order: 8 },
      { slug: 'wellness-mindfulness', name: 'Wellness & Mindfulness', iconName: 'heart-handshake', order: 9 },
      { slug: 'networking-professional', name: 'Networking & Career', iconName: 'briefcase', order: 10 },
      { slug: 'comedy-entertainment', name: 'Comedy & Entertainment', iconName: 'laugh', order: 11 },
      { slug: 'education-workshops', name: 'Education & Workshops', iconName: 'graduation-cap', order: 12 },
      { slug: 'family-kids', name: 'Family & Kids', iconName: 'baby', order: 13 },
      { slug: 'seasonal-holiday', name: 'Seasonal & Holiday', iconName: 'sparkles', order: 14 }
    ];

    const categorySlugToId = new Map();
    for (const cat of categoriesToEnsure) {
      const existing = await pool.query(`SELECT id FROM discover_categories WHERE slug = $1`, [cat.slug]);
      if (existing.rows.length > 0) {
        categorySlugToId.set(cat.slug, existing.rows[0].id);
        await pool.query(`UPDATE discover_categories SET is_active = true, name = $1, icon_name = $2, display_order = $3 WHERE id = $4`, [cat.name, cat.iconName, cat.order, existing.rows[0].id]);
      } else {
        const ins = await pool.query(`
          INSERT INTO discover_categories (name, slug, icon_name, display_order, is_active, created_at)
          VALUES ($1, $2, $3, $4, true, NOW())
          RETURNING id
        `, [cat.name, cat.slug, cat.iconName, cat.order]);
        categorySlugToId.set(cat.slug, ins.rows[0].id);
      }
    }

    const allExistingCats = await pool.query(`SELECT id, slug FROM discover_categories WHERE is_active = true`);
    allExistingCats.rows.forEach(r => {
      if (!categorySlugToId.has(r.slug)) {
        categorySlugToId.set(r.slug, r.id);
      }
    });
    console.log(`✓ Mapped ${categorySlugToId.size} discover categories.\n`);

    // 5. Setup Circles & Follows so Hero & Rails have strong personalisation scores
    console.log('🎯 5. Setting Circles, Follows, and Interest Vectors for User 51...');
    for (const [_, commId] of communityIdMap) {
      await pool.query(`
        INSERT INTO follows (follower_id, follower_type, following_id, following_type, created_at)
        VALUES (51, 'member', $1, 'community', NOW())
        ON CONFLICT DO NOTHING
      `, [commId]);
    }

    // Circles with User 51: ONLY Harsh (52) and Veena (155)
    await pool.query(`DELETE FROM circles WHERE user_a_id = 51 OR user_b_id = 51`);
    const circleFriends = [52, 155];
    for (const friendId of circleFriends) {
      await pool.query(`
        INSERT INTO circles (user_a_id, user_b_id, created_at)
        VALUES (51, $1, NOW())
        ON CONFLICT DO NOTHING
      `, [friendId]);
    }

    await pool.query(`DELETE FROM user_interest_vectors WHERE user_id = 51`);
    const user51Interests = [
      { slug: 'tech-startup', score: 10.0 },
      { slug: 'food-dining', score: 9.0 },
      { slug: 'music', score: 8.5 },
      { slug: 'outdoors-adventure', score: 8.0 },
      { slug: 'arts-culture', score: 7.5 },
    ];
    for (const item of user51Interests) {
      await pool.query(`
        INSERT INTO user_interest_vectors (user_id, category, raw_score, decayed_score, last_signal_at, created_at)
        VALUES (51, $1, $2, $2, NOW(), NOW())
      `, [item.slug, item.score]);
    }
    console.log(`✓ Personalized User 51 circles, follows, and interests for Explore rails.\n`);

    // 6. Define the Complete Curated Dataset (36 events with 100% relevant photography)
    console.log('🎉 6. Inserting Curated Events with Verified Photography...');
    const weekendDates = getUpcomingWeekendDates();

    const eventsList = [
      // ══════════════════════════════════════════════════════════════════
      // 1. HERO FLAGSHIP EVENT (Centerpiece of the Screen)
      // Score = 10 (Follow) + 10 (2 circle friends Harsh & Veena) = 20
      // ══════════════════════════════════════════════════════════════════
      {
        key: 'hero_summit',
        title: 'SnooSpace Breakthrough Summit 2026: Future of Tech & Culture',
        comm: 'snoospace',
        desc: 'The flagship annual gathering of mobile engineers, AI researchers, founders, and cultural creators in India. Keynotes, interactive demos, and live showcases.',
        loc: 'Bangalore International Exhibition Centre (BIEC)',
        city: 'Bangalore',
        start: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // In 4 days
        end: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000),
        price: 0,
        is_featured: true,
        max_attendees: 300,
        categories: ['Tech & Startup', 'Developer Conferences'],
        catSlugs: ['tech-startup', 'industry-conferences'],
        banner: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
        attendeeCount: 240,
        registeredAttendees: [52, 155, demoAttendeeIds[0], demoAttendeeIds[1]]
      },

      // ══════════════════════════════════════════════════════════════════
      // 2. LIVE NOW (Happening Right Now with Red Pulse)
      // ══════════════════════════════════════════════════════════════════
      {
        key: 'live_acoustic',
        title: 'Indie Acoustic Rooftop Jam',
        comm: 'blr_music_collective',
        desc: 'Happening live right now! Intimate acoustic performances, warm sunset melodies, and open stage jam.',
        loc: 'High Ultra Lounge, Malleshwaram',
        city: 'Bangalore',
        start: new Date(Date.now() - 35 * 60 * 1000), // Started 35m ago
        end: new Date(Date.now() + 2 * 60 * 60 * 1000), // Ends in 2h
        price: 199,
        is_featured: false,
        max_attendees: 50,
        categories: ['Music', 'Open Mic Nights'],
        catSlugs: ['music', 'open-mic-nights'],
        banner: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?auto=format&fit=crop&w=1200&q=80',
        attendeeCount: 38,
        registeredAttendees: [demoAttendeeIds[0], demoAttendeeIds[2], demoAttendeeIds[3]]
      },
      {
        key: 'live_saas_roundtable',
        title: 'Founder Roundtable: Scaling SaaS',
        comm: 'founders_hub_blr',
        desc: 'Live unscripted discussion with early-stage enterprise SaaS founders on go-to-market, inbound funnels, and pricing tiers.',
        loc: 'Indiranagar Social, Bangalore',
        city: 'Bangalore',
        start: new Date(Date.now() - 20 * 60 * 1000), // Started 20m ago
        end: new Date(Date.now() + 90 * 60 * 1000), // Ends in 1.5h
        price: 0,
        is_featured: false,
        max_attendees: 25, // Will trigger 4 spots left
        categories: ['Tech & Startup', 'Startup Meetups'],
        catSlugs: ['tech-startup', 'startup-meetups'],
        banner: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1200&q=80',
        attendeeCount: 21,
        registeredAttendees: [demoAttendeeIds[1], demoAttendeeIds[2], demoAttendeeIds[4]]
      },

      // ══════════════════════════════════════════════════════════════════
      // 3. THIS WEEKEND (Bento & Weekend Rail)
      // ══════════════════════════════════════════════════════════════════
      {
        key: 'weekend_techno_rave',
        title: 'Underground Warehouse Rave: Melodic Techno & Visual Art',
        comm: 'blr_music_collective',
        desc: 'Warehouse underground electronic music experience featuring dynamic laser projections, heavy bass, and visual mapping.',
        loc: 'Secret Warehouse, Indiranagar',
        city: 'Bangalore',
        start: weekendDates.friday,
        end: new Date(weekendDates.friday.getTime() + 5 * 60 * 60 * 1000),
        price: 699,
        is_featured: true,
        max_attendees: 150,
        categories: ['Nightlife & Parties', 'Club Nights'],
        catSlugs: ['nightlife-parties', 'club-nights', 'music'],
        banner: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80',
        attendeeCount: 84,
        registeredAttendees: [demoAttendeeIds[0], demoAttendeeIds[3], demoAttendeeIds[5]]
      },
      {
        key: 'weekend_cubbon_run',
        title: 'Cubbon Park Sunrise 10K Run & Specialty Pour-Over Club',
        comm: 'urban_fit_blr',
        desc: 'Scenic 10km morning run through Cubbon Park tree canopies, followed by hand-brewed specialty coffee and community stretches.',
        loc: 'Cubbon Park Bandstand, Bangalore',
        city: 'Bangalore',
        start: weekendDates.saturdayMorning,
        end: new Date(weekendDates.saturdayMorning.getTime() + 3 * 60 * 60 * 1000),
        price: 0,
        is_featured: true,
        max_attendees: 100,
        categories: ['Sports & Fitness', 'Run Clubs'],
        catSlugs: ['sports-fitness', 'outdoors-adventure'],
        banner: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=1200&q=80',
        attendeeCount: 62,
        registeredAttendees: [demoAttendeeIds[1], demoAttendeeIds[2], demoAttendeeIds[4]]
      },
      {
        key: 'weekend_pottery_wheel',
        title: 'Japanese Ceramic Wheel Throwing & Glazing Workshop',
        comm: 'clay_pottery_blr',
        desc: 'Hands-on tactile pottery masterclass. Learn centering on the electric wheel, pulling clay walls, and ceramic glazing techniques.',
        loc: 'Clay Station, HSR Layout, Bangalore',
        city: 'Bangalore',
        start: weekendDates.saturdayAfternoon,
        end: new Date(weekendDates.saturdayAfternoon.getTime() + 3 * 60 * 60 * 1000),
        price: 1499,
        is_featured: true,
        max_attendees: 18,
        categories: ['Arts & Culture', 'Craft & DIY Workshops'],
        catSlugs: ['arts-culture'],
        banner: 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=1200&q=80',
        attendeeCount: 16,
        registeredAttendees: [demoAttendeeIds[0], demoAttendeeIds[4], demoAttendeeIds[5]]
      },
      {
        key: 'weekend_sourdough_brunch',
        title: 'Artisan Sourdough & Fermented Baking Masterclass',
        comm: 'culinary_blr',
        desc: 'Master the wild fermentation cycle, scoring ear patterns, and baking crusty open-crumb sourdough boules with organic flour.',
        loc: 'The Conservatory, Shanthi Nagar',
        city: 'Bangalore',
        start: weekendDates.sundayMorning,
        end: new Date(weekendDates.sundayMorning.getTime() + 4 * 60 * 60 * 1000),
        price: 1200,
        is_featured: true,
        max_attendees: 20,
        categories: ['Food & Dining', 'Cooking Classes'],
        catSlugs: ['food-dining'],
        banner: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1200&q=80',
        attendeeCount: 19,
        registeredAttendees: [demoAttendeeIds[2], demoAttendeeIds[3], demoAttendeeIds[5]]
      },
      {
        key: 'weekend_ghats_camp',
        title: 'Western Ghats Mist Trail & Stargazing Camp',
        comm: 'adventure_ghats',
        desc: '2-day expedition through mist-covered peaks, lush canopy trails, natural spring waterfalls, and fireside starlight camping.',
        loc: 'Sakleshpur Ridge, Western Ghats',
        city: 'Bangalore',
        start: weekendDates.saturdayNightCamp,
        end: new Date(weekendDates.saturdayNightCamp.getTime() + 22 * 60 * 60 * 1000),
        price: 2499,
        is_featured: true,
        max_attendees: 25,
        categories: ['Outdoors & Adventure', 'Camping'],
        catSlugs: ['outdoors-adventure'],
        banner: 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=1200&q=80',
        attendeeCount: 22,
        registeredAttendees: [demoAttendeeIds[1], demoAttendeeIds[3], demoAttendeeIds[4]]
      },

      // ══════════════════════════════════════════════════════════════════
      // 4. CATEGORY RAIL 1: TECH & STARTUP (5 Events)
      // ══════════════════════════════════════════════════════════════════
      {
        key: 'tech_ai_hackathon',
        title: 'Autonomous AI Agents & Multi-Modal LLMs Hackathon',
        comm: 'tech_ai_guild',
        desc: '36-hour sprint building autonomous multi-agent systems, function calling architectures, and real-time edge workflows.',
        loc: 'WeWork Galaxy, Residency Road',
        city: 'Bangalore',
        start: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        end: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000),
        price: 0,
        is_featured: true,
        max_attendees: 120,
        categories: ['Tech & Startup', 'Hackathons'],
        catSlugs: ['tech-startup', 'hackathons'],
        banner: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80',
        attendeeCount: 96,
        registeredAttendees: [demoAttendeeIds[0], demoAttendeeIds[1], demoAttendeeIds[2]]
      },
      {
        key: 'tech_design_systems',
        title: 'Product Design Systems & Fluid Micro-Interactions Lab',
        comm: 'uiux_craft',
        desc: 'Architecting scalable token architectures, Figma variable variables, and spring physics for fluid mobile delight.',
        loc: 'BHIVE Workspace, HSR Layout',
        city: 'Bangalore',
        start: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
        end: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000),
        price: 0,
        is_featured: true,
        max_attendees: 60,
        categories: ['Tech & Startup', 'Product & Design Meetups'],
        catSlugs: ['tech-startup'],
        banner: 'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?auto=format&fit=crop&w=1200&q=80',
        attendeeCount: 54,
        registeredAttendees: [demoAttendeeIds[2], demoAttendeeIds[3], demoAttendeeIds[4]]
      },
      {
        key: 'tech_rust_distributed',
        title: 'Rust for Cloud-Native Distributed Systems',
        comm: 'tech_ai_guild',
        desc: 'Deep dive into Tokio async runtimes, zero-copy deserialization, and building fault-tolerant microservices in Rust.',
        loc: '91springboard, Koramangala',
        city: 'Bangalore',
        start: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
        price: 0,
        is_featured: false,
        max_attendees: 45,
        categories: ['Tech & Startup', 'Developer Conferences'],
        catSlugs: ['tech-startup'],
        banner: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=80',
        attendeeCount: 38,
        registeredAttendees: [demoAttendeeIds[0], demoAttendeeIds[3], demoAttendeeIds[5]]
      },
      {
        key: 'tech_women_founders',
        title: 'SheBuilds: Women Founders & Venture Capital Mixer',
        comm: 'founders_hub_blr',
        desc: 'Curated networking mixer bringing together visionary women entrepreneurs and top early-stage angel syndicates.',
        loc: 'The Leela Palace, Old Airport Road',
        city: 'Bangalore',
        start: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
        end: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
        price: 0,
        is_featured: false,
        max_attendees: 70,
        categories: ['Tech & Startup', 'Women in Tech'],
        catSlugs: ['tech-startup', 'women-in-tech'],
        banner: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1200&q=80',
        attendeeCount: 58,
        registeredAttendees: [demoAttendeeIds[0], demoAttendeeIds[1], demoAttendeeIds[4]]
      },
      {
        key: 'tech_spatial_visionos',
        title: 'Spatial Computing & VisionOS Developer Showcase',
        comm: 'tech_ai_guild',
        desc: 'Live hands-on testing of spatial computing experiences, RealityKit pipelines, and hand gesture interaction design.',
        loc: 'Koramangala Social Innovation Hub',
        city: 'Bangalore',
        start: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000),
        end: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000),
        price: 299,
        is_featured: false,
        max_attendees: 35,
        categories: ['Tech & Startup'],
        catSlugs: ['tech-startup'],
        banner: 'https://images.unsplash.com/photo-1593508512255-86ab42a8e620?auto=format&fit=crop&w=1200&q=80',
        attendeeCount: 31,
        registeredAttendees: [demoAttendeeIds[2], demoAttendeeIds[4], demoAttendeeIds[5]]
      },

      // ══════════════════════════════════════════════════════════════════
      // 5. CATEGORY RAIL 2: FOOD & DINING (4 Events)
      // ══════════════════════════════════════════════════════════════════
      {
        key: 'food_coffee_cupping',
        title: 'Third-Wave Coffee Cupping & Manual Brew Masterclass',
        comm: 'culinary_blr',
        desc: 'Explore terroir notes across single-origin estates from Chikmagalur and Araku Valley with certified Q-Graders.',
        loc: 'Araku Coffee, 12th Main Indiranagar',
        city: 'Bangalore',
        start: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000),
        end: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 13 * 60 * 60 * 1000),
        price: 650,
        is_featured: true,
        max_attendees: 22,
        categories: ['Food & Dining', 'Coffee & Cafe Meetups'],
        catSlugs: ['food-dining'],
        banner: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80',
        attendeeCount: 18,
        registeredAttendees: [demoAttendeeIds[0], demoAttendeeIds[2], demoAttendeeIds[4]]
      },
      {
        key: 'food_neapolitan_pizza',
        title: 'Handmade Neapolitan Pizza & Woodfired Oven Workshop',
        comm: 'culinary_blr',
        desc: 'Learn slow 48-hour cold fermentation dough, hand-stretched cornicione rims, and high-heat woodfired stone baking.',
        loc: 'Brik Oven, Church Street',
        city: 'Bangalore',
        start: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 17 * 60 * 60 * 1000),
        end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 20 * 60 * 60 * 1000),
        price: 1350,
        is_featured: false,
        max_attendees: 16,
        categories: ['Food & Dining', 'Cooking Classes'],
        catSlugs: ['food-dining'],
        banner: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&q=80',
        attendeeCount: 15,
        registeredAttendees: [demoAttendeeIds[1], demoAttendeeIds[3], demoAttendeeIds[5]]
      },
      {
        key: 'food_heritage_walk',
        title: 'Old Bangalore Heritage Street Food Walk',
        comm: 'culinary_blr',
        desc: 'A culinary journey through historic VV Puram and Basavanagudi: hot benne dosas, filter kaapi, and artisanal sweets.',
        loc: 'VV Puram Food Street, Bangalore',
        city: 'Bangalore',
        start: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000 + 18 * 60 * 60 * 1000),
        end: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000 + 21 * 60 * 60 * 1000),
        price: 450,
        is_featured: true,
        max_attendees: 30,
        categories: ['Food & Dining', 'Street Food Walks'],
        catSlugs: ['food-dining'],
        banner: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1200&q=80',
        attendeeCount: 26,
        registeredAttendees: [demoAttendeeIds[0], demoAttendeeIds[2], demoAttendeeIds[5]]
      },
      {
        key: 'food_wine_cheese',
        title: 'Natural Wine & Artisanal Cheese Pairing Evening',
        comm: 'culinary_blr',
        desc: 'Low-intervention biodynamic wines paired with handcrafted local artisanal cheeses and warm country sourdough.',
        loc: 'Sly Granny Rooftop, Indiranagar',
        city: 'Bangalore',
        start: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000 + 19 * 60 * 60 * 1000),
        end: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000 + 22 * 60 * 60 * 1000),
        price: 1800,
        is_featured: false,
        max_attendees: 24,
        categories: ['Food & Dining', 'Wine & Spirits Tasting'],
        catSlugs: ['food-dining'],
        banner: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=1200&q=80',
        attendeeCount: 22,
        registeredAttendees: [demoAttendeeIds[1], demoAttendeeIds[3], demoAttendeeIds[4]]
      },

      // ══════════════════════════════════════════════════════════════════
      // 6. CATEGORY RAIL 3: MUSIC & NIGHTLIFE (4 Events)
      // ══════════════════════════════════════════════════════════════════
      {
        key: 'music_vinyl_lofi',
        title: 'Midnight Vinyl Only: Lo-Fi Hip Hop & Neo-Soul Session',
        comm: 'blr_music_collective',
        desc: 'Pure analog needle-on-wax experience. Warm sub-bass, crackling vinyl grooves, and hand-curated Japanese jazz hop.',
        loc: 'The Record Room, Lavelle Road',
        city: 'Bangalore',
        start: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 21 * 60 * 60 * 1000),
        end: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 25 * 60 * 60 * 1000),
        price: 399,
        is_featured: false,
        max_attendees: 55,
        categories: ['Music', 'Indie & Alternative'],
        catSlugs: ['music'],
        banner: 'https://images.unsplash.com/photo-1539185441755-769473a23570?auto=format&fit=crop&w=1200&q=80',
        attendeeCount: 47,
        registeredAttendees: [demoAttendeeIds[0], demoAttendeeIds[1], demoAttendeeIds[3]]
      },
      {
        key: 'music_rooftop_jungle',
        title: 'Electric Botanical: Rooftop Jungle DJ Night',
        comm: 'blr_music_collective',
        desc: 'Deep progressive house rhythms set against lush botanical greens and illuminated glass terraces overlooking the city.',
        loc: 'Skyye Lounge, UB City',
        city: 'Bangalore',
        start: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 20 * 60 * 60 * 1000),
        end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000),
        price: 799,
        is_featured: false,
        max_attendees: 80,
        categories: ['Music', 'DJ Nights', 'Nightlife & Parties'],
        catSlugs: ['music', 'nightlife-parties'],
        banner: 'https://images.unsplash.com/photo-1545128485-c400e7702796?auto=format&fit=crop&w=1200&q=80',
        attendeeCount: 65,
        registeredAttendees: [demoAttendeeIds[2], demoAttendeeIds[4], demoAttendeeIds[5]]
      },
      {
        key: 'music_indie_rock',
        title: 'Indie Rock Showcase: Emerging Sounds of Bangalore',
        comm: 'blr_music_collective',
        desc: 'Electrifying 4-band showcase featuring the most promising indie rock and math rock acts in South India.',
        loc: 'Fandom at Gillys Reloaded, Koramangala',
        city: 'Bangalore',
        start: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000 + 19 * 60 * 60 * 1000),
        end: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000 + 23 * 60 * 60 * 1000),
        price: 499,
        is_featured: false,
        max_attendees: 120,
        categories: ['Music', 'Live Concerts'],
        catSlugs: ['music', 'live-concerts'],
        banner: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=1200&q=80',
        attendeeCount: 82,
        registeredAttendees: [demoAttendeeIds[1], demoAttendeeIds[3], demoAttendeeIds[4]]
      },
      {
        key: 'music_string_quartet',
        title: 'Candlelight Classical & Contemporary String Quartet',
        comm: 'blr_music_collective',
        desc: 'Surrounded by hundreds of warm glowing candles, experience spellbinding string arrangements of modern cinematic pieces.',
        loc: 'Bangalore International Centre (BIC), Domlur',
        city: 'Bangalore',
        start: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000 + 19 * 60 * 60 * 1000),
        end: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000 + 21 * 60 * 60 * 1000),
        price: 899,
        is_featured: false,
        max_attendees: 90,
        categories: ['Music', 'Classical & Fusion'],
        catSlugs: ['music'],
        banner: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
        attendeeCount: 71,
        registeredAttendees: [demoAttendeeIds[0], demoAttendeeIds[2], demoAttendeeIds[5]]
      },

      // ══════════════════════════════════════════════════════════════════
      // 7. CATEGORY RAIL 4: OUTDOORS & ADVENTURE (4 Events)
      // ══════════════════════════════════════════════════════════════════
      {
        key: 'outdoor_kayaking',
        title: 'Sunrise Kayaking & Paddleboarding on Manchanabele Lake',
        comm: 'adventure_ghats',
        desc: 'Glide across calm mirrored reservoir waters as mist lifts under the early morning sun. All safety gear and coaching included.',
        loc: 'Manchanabele Dam Reservoir',
        city: 'Bangalore',
        start: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000),
        end: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000),
        price: 1100,
        is_featured: true,
        max_attendees: 20,
        categories: ['Outdoors & Adventure', 'Adventure Sports'],
        catSlugs: ['outdoors-adventure'],
        banner: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80',
        attendeeCount: 17,
        registeredAttendees: [demoAttendeeIds[1], demoAttendeeIds[2], demoAttendeeIds[4]]
      },
      {
        key: 'outdoor_astronomy',
        title: 'Night Sky Astronomy & Meteor Shower Camp',
        comm: 'adventure_ghats',
        desc: 'Telescopic observation of Saturn rings, nebulae, and star clusters from a zero-light-pollution peak with astrophysicists.',
        loc: 'Madhugiri Monolith Base Camp',
        city: 'Bangalore',
        start: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 18 * 60 * 60 * 1000),
        end: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000),
        price: 1950,
        is_featured: false,
        max_attendees: 30,
        categories: ['Outdoors & Adventure', 'Camping'],
        catSlugs: ['outdoors-adventure'],
        banner: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
        attendeeCount: 27,
        registeredAttendees: [demoAttendeeIds[0], demoAttendeeIds[3], demoAttendeeIds[5]]
      },
      {
        key: 'outdoor_bouldering',
        title: 'Bouldering & Rock Climbing Clinic for Beginners',
        comm: 'urban_fit_blr',
        desc: 'Learn route reading, footwork mechanics, and body balance on high friction bouldering problems under expert guidance.',
        loc: 'Equilibrium Climbing Station, Indiranagar',
        city: 'Bangalore',
        start: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000 + 16 * 60 * 60 * 1000),
        end: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000 + 19 * 60 * 60 * 1000),
        price: 750,
        is_featured: false,
        max_attendees: 20,
        categories: ['Outdoors & Adventure', 'Rock Climbing'],
        catSlugs: ['outdoors-adventure'],
        banner: 'https://images.unsplash.com/photo-1522163182402-834f871fd851?auto=format&fit=crop&w=1200&q=80',
        attendeeCount: 16,
        registeredAttendees: [demoAttendeeIds[2], demoAttendeeIds[3], demoAttendeeIds[4]]
      },
      {
        key: 'outdoor_forest_cycling',
        title: 'Monsoon Forest Cycling Expedition: Nandi Hills Trail',
        comm: 'adventure_ghats',
        desc: '65km endurance gravel ride traversing eucalyptus groves and misty hairpin turns up to the historic Nandi hilltop temple.',
        loc: 'Nandi Foothills Start Point',
        city: 'Bangalore',
        start: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000),
        end: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000),
        price: 0,
        is_featured: false,
        max_attendees: 50,
        categories: ['Outdoors & Adventure', 'Cycling Expeditions'],
        catSlugs: ['outdoors-adventure'],
        banner: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=1200&q=80',
        attendeeCount: 39,
        registeredAttendees: [demoAttendeeIds[0], demoAttendeeIds[1], demoAttendeeIds[5]]
      },

      // ══════════════════════════════════════════════════════════════════
      // 8. CATEGORY RAIL 5: ARTS & CULTURE (4 Events)
      // ══════════════════════════════════════════════════════════════════
      {
        key: 'arts_watercolour',
        title: 'Botanical Watercolour & Gouache Painting Intensive',
        comm: 'uiux_craft',
        desc: 'Master wet-on-wet gradients, color mixing harmony, and fine-line brushwork rendering delicate tropical flora.',
        loc: 'Kala Madhyam Studio, Benson Town',
        city: 'Bangalore',
        start: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000),
        end: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000 + 17 * 60 * 60 * 1000),
        price: 850,
        is_featured: false,
        max_attendees: 18,
        categories: ['Arts & Culture', 'Craft & DIY Workshops'],
        catSlugs: ['arts-culture'],
        banner: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=80',
        attendeeCount: 15,
        registeredAttendees: [demoAttendeeIds[0], demoAttendeeIds[2], demoAttendeeIds[3]]
      },
      {
        key: 'arts_poetry_slam',
        title: 'Spoken Word Poetry Slam & Storytelling Open Stage',
        comm: 'uiux_craft',
        desc: 'An evening of raw spoken word poems, personal memoirs, and storytelling in English, Kannada, and Hindi.',
        loc: 'Atta Galatta, Indiranagar',
        city: 'Bangalore',
        start: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 18 * 60 * 60 * 1000),
        end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 21 * 60 * 60 * 1000),
        price: 250,
        is_featured: false,
        max_attendees: 45,
        categories: ['Arts & Culture', 'Poetry & Spoken Word'],
        catSlugs: ['arts-culture'],
        banner: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=1200&q=80',
        attendeeCount: 36,
        registeredAttendees: [demoAttendeeIds[1], demoAttendeeIds[4], demoAttendeeIds[5]]
      },
      {
        key: 'arts_darkroom_film',
        title: 'Darkroom 35mm Film Photography & Analog Print Lab',
        comm: 'uiux_craft',
        desc: 'Step into the red light. Develop black and white silver gelatin prints directly from 35mm film negatives.',
        loc: 'Bangalore Analog Guild, Domlur',
        city: 'Bangalore',
        start: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000 + 15 * 60 * 60 * 1000),
        end: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000 + 19 * 60 * 60 * 1000),
        price: 1250,
        is_featured: false,
        max_attendees: 12,
        categories: ['Arts & Culture', 'Photography Walks'],
        catSlugs: ['arts-culture'],
        banner: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80',
        attendeeCount: 11,
        registeredAttendees: [demoAttendeeIds[2], demoAttendeeIds[3], demoAttendeeIds[4]]
      },
      {
        key: 'arts_acrylic_pouring',
        title: 'Modern Abstract Acrylic Pouring & Texture Workshop',
        comm: 'uiux_craft',
        desc: 'Create vibrant fluid acrylic pieces utilizing blow techniques, palette knives, metallic leafing, and silicone cells.',
        loc: 'Lahe Lahe, HAL 2nd Stage, Indiranagar',
        city: 'Bangalore',
        start: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000),
        end: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000),
        price: 950,
        is_featured: false,
        max_attendees: 20,
        categories: ['Arts & Culture', 'Art Exhibitions'],
        catSlugs: ['arts-culture'],
        banner: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=1200&q=80',
        attendeeCount: 18,
        registeredAttendees: [demoAttendeeIds[0], demoAttendeeIds[1], demoAttendeeIds[5]]
      },

      // ══════════════════════════════════════════════════════════════════
      // 9. SOMETHING DIFFERENT (Exclusive Niche Activities)
      // Registrations set to 72 hours ago so they don't enter 48h velocity What's Hot
      // ══════════════════════════════════════════════════════════════════
      {
        key: 'diff_sound_bath',
        title: 'Tibetan Full-Moon Singing Bowls & Sound Bath Healing',
        comm: 'urban_fit_blr',
        desc: 'Immersive sound resonance healing session with antique bronze singing bowls to reset brainwave frequency and release tension.',
        loc: 'Shanti Wellness Shala, Lavelle Road',
        city: 'Bangalore',
        start: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000 + 18 * 60 * 60 * 1000),
        end: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000 + 20 * 60 * 60 * 1000),
        price: 800,
        is_featured: false,
        max_attendees: 25,
        categories: ['Wellness & Mindfulness', 'Sound Healing'],
        catSlugs: ['wellness-mindfulness', 'sound-healing'],
        banner: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80',
        attendeeCount: 21,
        regAgeHours: 72,
        registeredAttendees: [demoAttendeeIds[0], demoAttendeeIds[1], demoAttendeeIds[2]]
      },
      {
        key: 'diff_boardgame_catan',
        title: 'Competitive Catan & Terraforming Mars Marathon',
        comm: 'boardgame_esports_blr',
        desc: 'All-night euro-style strategy gaming marathon. 8 tables with Catan, Dune Imperium, Wingspan, and brass birmingham.',
        loc: 'Dice & Dine Board Game Cafe, Koramangala',
        city: 'Bangalore',
        start: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 17 * 60 * 60 * 1000),
        end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 23 * 60 * 60 * 1000),
        price: 250,
        is_featured: false,
        max_attendees: 40,
        categories: ['Gaming & Esports', 'Board Game Nights'],
        catSlugs: ['gaming-esports'],
        banner: 'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?auto=format&fit=crop&w=1200&q=80',
        attendeeCount: 32,
        regAgeHours: 72,
        registeredAttendees: [demoAttendeeIds[2], demoAttendeeIds[3], demoAttendeeIds[4]]
      },
      {
        key: 'diff_comedy_openmic',
        title: 'Stand-Up Comedy Trial Showcase: Unfiltered Punchlines',
        comm: 'founders_hub_blr',
        desc: 'Fresh test sets and crowd work from rising comic headliners. An unfiltered, laugh-out-loud evening in an intimate theater.',
        loc: 'The Underground Comedy Club, Koramangala',
        city: 'Bangalore',
        start: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000 + 20 * 60 * 60 * 1000),
        end: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000 + 22 * 60 * 60 * 1000),
        price: 300,
        is_featured: false,
        max_attendees: 60,
        categories: ['Comedy & Entertainment', 'Stand-up Open Mics'],
        catSlugs: ['comedy-entertainment'],
        banner: 'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?auto=format&fit=crop&w=1200&q=80',
        attendeeCount: 48,
        regAgeHours: 72,
        registeredAttendees: [demoAttendeeIds[3], demoAttendeeIds[4], demoAttendeeIds[5]]
      },
      {
        key: 'diff_magic_mentalism',
        title: 'Mind Games: Sleight of Hand & Mentalism Parlour',
        comm: 'founders_hub_blr',
        desc: 'An intimate evening of psychological illusions, thought reading, and classic sleight-of-hand artistry in a Victorian speakeasy.',
        loc: 'Secret Speakeasy, Church Street',
        city: 'Bangalore',
        start: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000 + 19 * 60 * 60 * 1000),
        end: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000 + 21 * 60 * 60 * 1000),
        price: 550,
        is_featured: false,
        max_attendees: 30,
        categories: ['Comedy & Entertainment', 'Magic Shows'],
        catSlugs: ['comedy-entertainment', 'magic-shows'],
        banner: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
        attendeeCount: 22,
        regAgeHours: 72,
        registeredAttendees: [demoAttendeeIds[0], demoAttendeeIds[4], demoAttendeeIds[5]]
      },
      {
        key: 'diff_pups_social',
        title: 'Golden Retrievers & Pups Sunset Social Playdate',
        comm: 'urban_fit_blr',
        desc: 'Unleashed fun, agility obstacle courses, pet treats, and dog parent networking at an enclosed lakeside dog park.',
        loc: 'Doggie Dudes Park, Sarjapur Road',
        city: 'Bangalore',
        start: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000 + 16 * 60 * 60 * 1000),
        end: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000 + 18 * 60 * 60 * 1000),
        price: 0,
        is_featured: false,
        max_attendees: 40,
        categories: ['Family & Kids', 'Pet Meetups'],
        catSlugs: ['pet-meetups'],
        banner: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1200&q=80',
        attendeeCount: 28,
        regAgeHours: 72,
        registeredAttendees: [demoAttendeeIds[1], demoAttendeeIds[2], demoAttendeeIds[3]]
      }
    ];

    const eventKeyToId = new Map();

    for (const ev of eventsList) {
      const commId = communityIdMap.get(ev.comm) || communityIdMap.get('snoospace');

      const ins = await pool.query(`
        INSERT INTO events (
          community_id, title, description, location_name, city,
          event_date, start_datetime, end_datetime,
          is_published, is_cancelled, access_type, invite_public_visibility,
          ticket_price, is_paid, is_featured, max_attendees, categories, banner_url, created_at,
          like_count, comment_count, view_count, share_count
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $6, $7,
          true, false, 'public', true,
          $8, $9, $10, $11, $12, $13, NOW(),
          $14, $15, $16, $17
        ) RETURNING id, title
      `, [
        commId, ev.title, ev.desc, ev.loc, ev.city,
        ev.start, ev.end,
        ev.price, ev.price > 0, Boolean(ev.is_featured), ev.max_attendees, ev.categories, ev.banner,
        ev.attendeeCount, Math.floor(ev.attendeeCount / 4), ev.attendeeCount * 4, Math.floor(ev.attendeeCount / 5)
      ]);

      const eventId = ins.rows[0].id;
      eventKeyToId.set(ev.key, eventId);

      // Insert primary banner into event_banners
      await pool.query(`
        INSERT INTO event_banners (event_id, image_url, image_order, created_at)
        VALUES ($1, $2, 0, NOW())
      `, [eventId, ev.banner]);

      // Link to discover_categories
      for (const slug of ev.catSlugs) {
        const catId = categorySlugToId.get(slug);
        if (catId) {
          await pool.query(`
            INSERT INTO event_discover_categories (event_id, category_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `, [eventId, catId]);
        }
      }

      // Add registrations for avatar stacks & velocity
      const regAge = ev.regAgeHours || 12;
      if (Array.isArray(ev.registeredAttendees)) {
        for (const memberId of ev.registeredAttendees) {
          await pool.query(`
            INSERT INTO event_registrations (event_id, member_id, registration_status, created_at)
            VALUES ($1, $2, 'registered', NOW() - INTERVAL '${regAge} hours')
            ON CONFLICT DO NOTHING
          `, [eventId, memberId]);
        }
      }
    }
    console.log(`✓ Inserted all ${eventsList.length} events with matching photography & registrations.\n`);

    // 7. Seed Curated Lists
    console.log('📚 7. Inserting 3 Curated Lists with Themed Banners...');
    const curatedListsConfig = [
      {
        title: 'Bangalore Specialty Coffee & Roastery Trail',
        subtitle: 'From single-origin seed to cup: 4 artisanal roasteries and brew labs',
        coverUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80',
        displayOrder: 1,
        eventKeys: ['food_coffee_cupping', 'weekend_sourdough_brunch', 'food_heritage_walk']
      },
      {
        title: 'Underground Sound & Electronic Collectives',
        subtitle: 'Warehouse sets, rooftop sessions, and vinyl listening rooms',
        coverUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80',
        displayOrder: 2,
        eventKeys: ['weekend_techno_rave', 'music_vinyl_lofi', 'music_rooftop_jungle', 'music_indie_rock']
      },
      {
        title: 'Off-Grid Escapes: Western Ghats & Nature Trails',
        subtitle: 'Weekend adventures and wilderness trail expeditions beyond the concrete',
        coverUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
        displayOrder: 3,
        eventKeys: ['weekend_ghats_camp', 'outdoor_kayaking', 'outdoor_astronomy', 'outdoor_forest_cycling']
      }
    ];

    for (const list of curatedListsConfig) {
      const listIns = await pool.query(`
        INSERT INTO curated_lists (title, subtitle, cover_url, display_order, is_active, created_at)
        VALUES ($1, $2, $3, $4, true, NOW())
        RETURNING id
      `, [list.title, list.subtitle, list.coverUrl, list.displayOrder]);
      const listId = listIns.rows[0].id;

      let order = 1;
      for (const evKey of list.eventKeys) {
        const evId = eventKeyToId.get(evKey);
        if (evId) {
          await pool.query(`
            INSERT INTO curated_list_events (curated_list_id, event_id, display_order, created_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT DO NOTHING
          `, [listId, evId, order++]);
        }
      }
    }
    console.log(`✓ Inserted 3 Curated Lists with linked events.\n`);

    // 8. Test getExploreFeed API payload directly to verify
    console.log('🔍 8. Verifying getExploreFeed Payload for User 51...');
    const exploreController = require('../controllers/exploreController');
    let feedResponse = null;
    const mockReq = {
      user: { id: 51, type: 'member' },
      app: { locals: { pool } }
    };
    const mockRes = {
      json: (data) => { feedResponse = data; },
      status: () => mockRes
    };

    await exploreController.getExploreFeed(mockReq, mockRes);

    console.log('\n════════════════════════════════════════════════════════════════');
    console.log('✨ EXPLORE FEED PAYLOAD VERIFICATION RESULTS');
    console.log('════════════════════════════════════════════════════════════════');
    console.log(`1. HERO EVENT: "${feedResponse.hero?.title}"`);
    console.log(`   - Image: ${feedResponse.hero?.coverUrl?.substring(0, 50)}...`);
    console.log(`   - Attendees: ${feedResponse.hero?.attendeeCount} going`);
    console.log(`   - Avatar Stack Count: ${feedResponse.hero?.attendeeAvatars?.length || 0} avatars\n`);

    console.log(`2. LIVE NOW (${feedResponse.liveNow?.length || 0} events):`);
    (feedResponse.liveNow || []).forEach(e => console.log(`   • [LIVE] "${e.title}" | Spots left: ${e.spotsLeft || 'N/A'}`));

    console.log(`\n3. THIS WEEKEND (${feedResponse.weekend?.length || 0} events):`);
    (feedResponse.weekend || []).forEach(e => console.log(`   • "${e.title}" (${e.category}) - Free: ${e.isFree}`));

    console.log(`\n4. WHAT'S HOT (${feedResponse.whatsHot?.length || 0} events):`);
    (feedResponse.whatsHot || []).forEach(e => console.log(`   • "${e.title}" (${e.attendeeCount} attendees)`));

    console.log(`\n5. CATEGORY RAILS (${feedResponse.categoryRails?.length || 0} rails):`);
    (feedResponse.categoryRails || []).forEach(rail => {
      console.log(`   📂 Rail: ${rail.category} (${rail.events?.length || 0} events, Color: ${rail.categoryColor?.bg} / ${rail.categoryColor?.text}):`);
      rail.events.forEach(e => console.log(`      - "${e.title}" (${e.attendeeCount} going)`));
    });

    console.log(`\n6. SOMETHING DIFFERENT (${feedResponse.somethingDifferent?.length || 0} events):`);
    (feedResponse.somethingDifferent || []).forEach(e => console.log(`   • "${e.title}" (${e.categoryName})`));

    console.log(`\n7. CURATED LISTS (${feedResponse.curatedLists?.length || 0} lists):`);
    (feedResponse.curatedLists || []).forEach(l => console.log(`   • [List: ${l.title}] (${l.events?.length || 0} events)`));

    console.log('\n================================================================');
    console.log('🎉 MARKETING EXPLORE SCREEN SEEDING 100% COMPLETE & VERIFIED!');
    console.log('================================================================\n');

  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedMarketingExploreFeed();
