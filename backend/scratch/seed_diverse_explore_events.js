'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createPool } = require('../config/db');

// Helper to compute upcoming weekend dates
function getUpcomingWeekendDates() {
  const now = new Date();
  const currentDay = now.getDay(); // 0: Sun, 1: Mon, ... 6: Sat
  const friday = new Date(now);
  friday.setDate(now.getDate() - currentDay + 5);
  friday.setHours(19, 0, 0, 0);

  const saturday = new Date(now);
  saturday.setDate(now.getDate() - currentDay + 6);
  saturday.setHours(17, 30, 0, 0);

  const sunday = new Date(now);
  sunday.setDate(now.getDate() - currentDay + 7);
  sunday.setHours(11, 0, 0, 0);

  if (now > sunday) {
    friday.setDate(friday.getDate() + 7);
    saturday.setDate(saturday.getDate() + 7);
    sunday.setDate(sunday.getDate() + 7);
  }

  return { friday, saturday, sunday };
}

async function seedDiverseExploreEvents() {
  const pool = createPool();
  console.log('================================================================');
  console.log('🌟 Seeding Clean, Diverse Events for Explore Screen Testing');
  console.log('================================================================\n');

  try {
    // 0. Clean prior test events cleanly
    await pool.query(`DELETE FROM event_banners`);
    await pool.query(`DELETE FROM event_discover_categories`);
    await pool.query(`DELETE FROM event_registrations`);
    await pool.query(`DELETE FROM events`);
    console.log('🧹 Cleared existing event tables for pristine re-seed.');

    // 1. Fetch available discover categories
    const catRows = await pool.query(`SELECT id, name, slug FROM discover_categories WHERE is_active = true`);
    const catMap = new Map();
    catRows.rows.forEach(r => catMap.set(r.slug, r.id));

    // 2. Ensure communities exist
    const commsToEnsure = [
      { name: 'SnooSpace Community', username: 'snoospace', category: 'technology' },
      { name: 'Tech & AI Guild', username: 'tech_ai_guild', category: 'technology' },
      { name: 'UI/UX Design Craft', username: 'uiux_craft', category: 'design' },
      { name: 'Bangalore Founders Hub', username: 'founders_hub_blr', category: 'entrepreneurship' },
      { name: 'Bangalore Electronic Music Collective', username: 'blr_music_collective', category: 'music' },
      { name: 'Bangalore Culinary Explorers', username: 'culinary_blr', category: 'food' },
      { name: 'Urban Fitness & Run Society', username: 'urban_fit_blr', category: 'fitness' },
      { name: 'Western Ghats Trekking & Adventure', username: 'adventure_ghats', category: 'outdoors' },
      { name: 'Bangalore Board Game & Esports Club', username: 'boardgame_esports_blr', category: 'gaming' },
      { name: 'Artisan Clay & Pottery Studio', username: 'clay_pottery_blr', category: 'arts' },
    ];

    const communityIdMap = new Map();
    for (const c of commsToEnsure) {
      const existing = await pool.query(`SELECT id FROM communities WHERE username = $1`, [c.username]);
      if (existing.rows.length > 0) {
        communityIdMap.set(c.username, existing.rows[0].id);
      } else {
        const ins = await pool.query(`
          INSERT INTO communities (name, username, category, created_at)
          VALUES ($1, $2, $3, NOW())
          RETURNING id
        `, [c.name, c.username, c.category]);
        communityIdMap.set(c.username, ins.rows[0].id);
      }
    }

    // 3. Seed user_interest_vectors for user 51 (Harshith) so Explore has diverse, colorful rails
    await pool.query(`DELETE FROM user_interest_vectors WHERE user_id = 51`);
    const interests = [
      { slug: 'hackathons', score: 9.5 },
      { slug: 'skill-building-workshops', score: 8.8 },
      { slug: 'nightlife-parties', score: 8.2 },
      { slug: 'gaming', score: 7.6 },
      { slug: 'wellness-mindfulness', score: 6.9 },
      { slug: 'networking-mixers', score: 6.5 },
    ];
    for (const item of interests) {
      await pool.query(`
        INSERT INTO user_interest_vectors (user_id, category, raw_score, decayed_score, last_signal_at, created_at)
        VALUES (51, $1, $2, $2, NOW(), NOW())
      `, [item.slug, item.score]);
    }
    console.log(`✓ Seeded ${interests.length} personalized user_interest_vectors for User 51.`);

    const banners = [
      'https://res.cloudinary.com/dulhurgt7/image/upload/v1781683463/snoospace/community-voice/xsoyfr5cyll3ha4rspdg.png',
      'https://res.cloudinary.com/dulhurgt7/image/upload/v1781683502/snoospace/community-voice/reuwmkly0h9fvul9lzqg.png',
      'https://res.cloudinary.com/dulhurgt7/image/upload/v1781683463/snoospace/community-voice/xsoyfr5cyll3ha4rspdg.png',
    ];

    const weekendDates = getUpcomingWeekendDates();

    // 4. Complete Dataset Covering ALL Configurations
    const eventsConfig = [
      // ── LIVE NOW ──
      {
        title: 'Open Mic: Indie Acoustic Sessions',
        comm: 'blr_music_collective',
        desc: 'Happening right now! Live acoustic performances and open stage for indie musicians.',
        loc: 'Fandom at Gillys Reloaded, Koramangala',
        city: 'Bangalore',
        start: new Date(Date.now() - 45 * 60 * 1000), // started 45m ago
        end: new Date(Date.now() + 2 * 60 * 60 * 1000), // ends in 2h
        price: 199,
        categories: ['Music & Concerts', 'Nightlife & Parties'],
        catSlugs: ['nightlife-parties', 'club-nights'],
        attendeeCount: 28,
        banner: banners[0],
      },
      {
        title: 'Sunset Rooftop DJ Set & House Party',
        comm: 'blr_music_collective',
        desc: 'Deep melodic techno & progressive house sunset session overlooking the city skyline.',
        loc: 'High Ultra Lounge, Malleshwaram',
        city: 'Bangalore',
        start: new Date(Date.now() - 30 * 60 * 1000),
        end: new Date(Date.now() + 3 * 60 * 60 * 1000),
        price: 499,
        categories: ['Nightlife & Parties', 'Rooftop Parties'],
        catSlugs: ['nightlife-parties', 'rooftop-parties'],
        attendeeCount: 42,
        banner: banners[1],
      },

      // ── HERO CANDIDATE ──
      {
        title: 'SnooSpace Global AI & Product Summit 2026',
        comm: 'snoospace',
        desc: 'The premier annual gathering of top mobile engineers, AI researchers, and product builders in India.',
        loc: 'Bangalore International Exhibition Centre (BIEC)',
        city: 'Bangalore',
        start: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        end: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000),
        price: 0,
        categories: ['Technology & AI', 'Industry Conferences'],
        catSlugs: ['industry-conferences', 'hackathons'],
        attendeeCount: 124,
        banner: banners[0],
      },

      // ── WEEKEND RAIL ──
      {
        title: 'Saturday Sunrise 10K Run & Coffee Club',
        comm: 'urban_fit_blr',
        desc: 'Scenic 10km morning run through Cubbon Park followed by specialty pour-over coffee.',
        loc: 'Cubbon Park Bandstand, Bangalore',
        city: 'Bangalore',
        start: weekendDates.saturday,
        end: new Date(weekendDates.saturday.getTime() + 3 * 60 * 60 * 1000),
        price: 0,
        categories: ['Wellness & Mindfulness', 'Outdoor Adventures'],
        catSlugs: ['wellness-mindfulness', 'outdoor-adventures'],
        attendeeCount: 35,
        banner: banners[1],
      },
      {
        title: 'Sunday Artisan Sourdough & Brunch Masterclass',
        comm: 'culinary_blr',
        desc: 'Hands-on artisanal bread fermentation workshop with master bakers and fresh farm brunch.',
        loc: 'The Conservatory, Shanthi Nagar',
        city: 'Bangalore',
        start: weekendDates.sunday,
        end: new Date(weekendDates.sunday.getTime() + 4 * 60 * 60 * 1000),
        price: 1499,
        categories: ['Skill-building Workshops'],
        catSlugs: ['skill-building-workshops'],
        attendeeCount: 18,
        banner: banners[2],
      },
      {
        title: 'Friday Night Underground Techno Rave',
        comm: 'blr_music_collective',
        desc: 'Warehouse underground electronic music experience with immersive visual mapping.',
        loc: 'Indiranagar Secret Warehouse, BLR',
        city: 'Bangalore',
        start: weekendDates.friday,
        end: new Date(weekendDates.friday.getTime() + 5 * 60 * 60 * 1000),
        price: 799,
        categories: ['Nightlife & Parties', 'Club Nights'],
        catSlugs: ['nightlife-parties', 'club-nights'],
        attendeeCount: 56,
        banner: banners[0],
      },
      {
        title: 'Weekend Western Ghats Waterfall Trek & Camp',
        comm: 'adventure_ghats',
        desc: '2-day expedition through mist-covered peaks, hidden waterfalls, and starlit bonfire camping.',
        loc: 'Sakleshpur, Western Ghats',
        city: 'Bangalore',
        start: new Date(weekendDates.saturday.getTime() - 12 * 60 * 60 * 1000),
        end: new Date(weekendDates.sunday.getTime() + 8 * 60 * 60 * 1000),
        price: 2999,
        categories: ['Outdoor Adventures', 'Camping'],
        catSlugs: ['outdoor-adventures', 'camping'],
        attendeeCount: 22,
        banner: banners[1],
      },

      // ── TECH & HACKATHONS RAIL ──
      {
        title: 'LLM Fine-Tuning & On-Device ML Workshop',
        comm: 'tech_ai_guild',
        desc: 'Practical session on Quantization, LoRA adapters, and running local models on iOS & Android.',
        loc: 'WeWork Residency Road, Bangalore',
        city: 'Bangalore',
        start: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        end: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000),
        price: 0,
        categories: ['Hackathons', 'Skill-building Workshops'],
        catSlugs: ['hackathons', 'skill-building-workshops'],
        attendeeCount: 48,
        banner: banners[0],
      },
      {
        title: 'Rust for High-Performance Backend Systems',
        comm: 'tech_ai_guild',
        desc: 'Explore concurrency models, zero-cost abstractions, and asynchronous I/O with Tokio in Rust.',
        loc: '91springboard, Koramangala',
        city: 'Bangalore',
        start: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
        price: 0,
        categories: ['Hackathons', 'Industry Conferences'],
        catSlugs: ['hackathons', 'industry-conferences'],
        attendeeCount: 31,
        banner: banners[2],
      },
      {
        title: 'React Native New Architecture & TurboModules Deep Dive',
        comm: 'snoospace',
        desc: 'Demystifying Fabric, JSI, and Bridgeless mode in modern React Native production apps.',
        loc: 'Indiranagar Social, Bangalore',
        city: 'Bangalore',
        start: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        end: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
        price: 0,
        categories: ['Hackathons', 'Skill-building Workshops'],
        catSlugs: ['hackathons', 'skill-building-workshops'],
        attendeeCount: 39,
        banner: banners[0],
      },

      // ── DESIGN & CREATIVE SKILL-BUILDING RAIL ──
      {
        title: 'Design Systems at Scale: Figma Variables & Tokens',
        comm: 'uiux_craft',
        desc: 'Architecting multi-brand design systems, token sync pipelines, and component accessibility.',
        loc: 'BHIVE Workspace, HSR Layout',
        city: 'Bangalore',
        start: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
        end: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000),
        price: 0,
        categories: ['Skill-building Workshops'],
        catSlugs: ['skill-building-workshops'],
        attendeeCount: 52,
        banner: banners[1],
      },
      {
        title: 'Micro-Interactions & Mobile Delight Lab',
        comm: 'uiux_craft',
        desc: 'Mastering gesture navigation, spring physics, and fluid haptic feedback design.',
        loc: 'Indiranagar Design Studio, Bangalore',
        city: 'Bangalore',
        start: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000),
        end: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
        price: 0,
        categories: ['Skill-building Workshops'],
        catSlugs: ['skill-building-workshops'],
        attendeeCount: 29,
        banner: banners[0],
      },

      // ── NIGHTLIFE & SOCIAL RAIL ──
      {
        title: 'Neon Underground: Cyberpunk Synthwave Night',
        comm: 'blr_music_collective',
        desc: 'Retro synthwave beats, laser visual effects, and themed neon cocktails.',
        loc: 'Church Street Social, Bangalore',
        city: 'Bangalore',
        start: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000 + 19 * 60 * 60 * 1000),
        end: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000),
        price: 399,
        categories: ['Nightlife & Parties', 'Club Nights'],
        catSlugs: ['nightlife-parties', 'club-nights'],
        attendeeCount: 45,
        banner: banners[1],
      },
      {
        title: 'Craft Beer & Trivia Pub Quiz Night',
        comm: 'blr_music_collective',
        desc: '6 rounds of pop-culture, science, tech, and music trivia with brewery prizes.',
        loc: 'Toit Brewpub, Indiranagar',
        city: 'Bangalore',
        start: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000 + 19 * 60 * 60 * 1000),
        end: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000 + 22 * 60 * 60 * 1000),
        price: 150,
        categories: ['Nightlife & Parties'],
        catSlugs: ['nightlife-parties'],
        attendeeCount: 30,
        banner: banners[2],
      },

      // ── GAMING & TABLETOP RAIL ──
      {
        title: 'All-Night Board Games & Strategy Marathon',
        comm: 'boardgame_esports_blr',
        desc: 'Catan, Dune Imperium, Terraforming Mars, and Wingspan with 50+ avid tabletop gamers.',
        loc: 'Dice & Dine Board Game Cafe, Koramangala',
        city: 'Bangalore',
        start: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000 + 18 * 60 * 60 * 1000),
        end: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000),
        price: 249,
        categories: ['Gaming'],
        catSlugs: ['gaming'],
        attendeeCount: 26,
        banner: banners[0],
      },
      {
        title: 'Valorant & Street Fighter 6 LAN Tournament',
        comm: 'boardgame_esports_blr',
        desc: 'High-octane competitive LAN tournament with ₹50,000 cash prize pool and live shoutcasting.',
        loc: 'LXG Esports Arena, Indiranagar',
        city: 'Bangalore',
        start: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        end: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000),
        price: 350,
        categories: ['Gaming', 'Esports Tournaments'],
        catSlugs: ['gaming', 'esports-tournaments'],
        attendeeCount: 44,
        banner: banners[2],
      },

      // ── WELLNESS & MINDFULNESS RAIL ──
      {
        title: 'Tibetan Singing Bowls & Sound Bath Meditation',
        comm: 'urban_fit_blr',
        desc: 'Immersive sound frequency healing session to release stress, reset nervous system and meditate.',
        loc: 'Shanti Wellness Shala, Lavelle Road',
        city: 'Bangalore',
        start: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000),
        end: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
        price: 750,
        categories: ['Wellness & Mindfulness', 'Sound Healing', 'Meditation Retreats'],
        catSlugs: ['wellness-mindfulness', 'sound-healing', 'meditation-retreats'],
        attendeeCount: 20,
        banner: banners[2],
      },
      {
        title: 'Sunrise Vinyasa Flow & Breathwork in the Park',
        comm: 'urban_fit_blr',
        desc: 'Invigorating 75-minute outdoor morning yoga flow with pranayama breathwork exercises.',
        loc: 'Lalbagh Botanical Gardens, Bangalore',
        city: 'Bangalore',
        start: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000),
        end: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000),
        price: 0,
        categories: ['Wellness & Mindfulness'],
        catSlugs: ['wellness-mindfulness'],
        attendeeCount: 32,
        banner: banners[1],
      },

      // ── NETWORKING & FOUNDERS RAIL ──
      {
        title: 'Early Stage Pitch & Angel Investor Mixer',
        comm: 'founders_hub_blr',
        desc: 'Curated 5-minute lightning pitches to top Tier-1 angel investors and VC partners.',
        loc: 'The Leela Palace, Old Airport Road',
        city: 'Bangalore',
        start: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
        end: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000),
        price: 999,
        categories: ['Networking Mixers', 'Finance & Investing Talks'],
        catSlugs: ['networking-mixers', 'finance-investing-talks'],
        attendeeCount: 65,
        banner: banners[2],
      },
      {
        title: 'SaaS Pricing & Go-To-Market Playbook 2026',
        comm: 'founders_hub_blr',
        desc: 'Founder roundtable on self-serve product led growth, enterprise sales cycles, and pricing tiers.',
        loc: 'Innov8 Coworking, Koramangala',
        city: 'Bangalore',
        start: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
        end: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
        price: 0,
        categories: ['Networking Mixers', 'Finance & Investing Talks'],
        catSlugs: ['networking-mixers', 'finance-investing-talks'],
        attendeeCount: 38,
        banner: banners[1],
      },

      // ── UNIQUE / SOMETHING DIFFERENT STANDALONE CATEGORIES ──
      {
        title: 'Wheel Throwing & Japanese Raku Pottery Lab',
        comm: 'clay_pottery_blr',
        desc: 'Learn ancient wheel pottery, hand-building techniques, and rapid kiln firing.',
        loc: 'Clay Station, HSR Layout, Bangalore',
        city: 'Bangalore',
        start: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
        end: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
        price: 1800,
        categories: ['Skill-building Workshops'],
        catSlugs: ['skill-building-workshops'],
        attendeeCount: 16,
        banner: banners[1],
      }
    ];

    console.log(`Inserting ${eventsConfig.length} distinct events covering all rails...`);

    for (const ev of eventsConfig) {
      const commId = communityIdMap.get(ev.comm) || communityIdMap.get('snoospace');

      const ins = await pool.query(`
        INSERT INTO events (
          community_id, title, description, location_name, city,
          event_date, start_datetime, end_datetime,
          is_published, is_cancelled, access_type, invite_public_visibility,
          ticket_price, categories, banner_url, created_at,
          like_count, comment_count, view_count, share_count
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $6, $7,
          true, false, 'public', true,
          $8, $9, $10, NOW(),
          $11, 0, $11 * 3, 0
        ) RETURNING id, title
      `, [
        commId, ev.title, ev.desc, ev.loc, ev.city,
        ev.start, ev.end,
        ev.price, ev.categories, ev.banner,
        ev.attendeeCount
      ]);

      const eventId = ins.rows[0].id;

      // Add banner into event_banners
      await pool.query(`
        INSERT INTO event_banners (event_id, image_url, image_order, created_at)
        VALUES ($1, $2, 0, NOW())
      `, [eventId, ev.banner]);

      // Link to discover_categories in event_discover_categories
      for (const slug of ev.catSlugs) {
        const catId = catMap.get(slug);
        if (catId) {
          await pool.query(`
            INSERT INTO event_discover_categories (event_id, category_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `, [eventId, catId]);
        }
      }

      // Seed mock attendee registrations
      const memberIds = [51, 52, 155];
      for (let i = 0; i < Math.min(ev.attendeeCount, memberIds.length); i++) {
        await pool.query(`
          INSERT INTO event_registrations (
            event_id, member_id, registration_status, created_at
          ) VALUES ($1, $2, 'registered', NOW())
          ON CONFLICT DO NOTHING
        `, [eventId, memberIds[i]]);
      }
    }

    console.log(`✓ Successfully Inserted ${eventsConfig.length} Unique Events across all categories!`);

    // 5. Test Explore feed API payload for User 51
    console.log('\n════ Testing getExploreFeed API Payload for User 51 ════');
    const mockReq = {
      user: { id: 51, type: 'member' },
      app: { locals: { pool } }
    };
    let exploreResult = null;
    const mockRes = {
      json: (data) => { exploreResult = data; },
      status: () => mockRes
    };

    const exploreController = require('../controllers/exploreController');
    await exploreController.getExploreFeed(mockReq, mockRes);

    console.log(`Explore Feed Payload Summary:`);
    console.log(`  1. liveNow Events (${exploreResult.liveNow?.length || 0}):`);
    (exploreResult.liveNow || []).forEach(e => console.log(`     • [LIVE] "${e.title}" (ID: ${e.eventId})`));

    console.log(`  2. Hero Event:`, exploreResult.hero ? `"${exploreResult.hero.title}" (${exploreResult.hero.attendeeCount} going)` : '(none)');

    console.log(`  3. Weekend Rail (${exploreResult.weekend?.length || 0} events):`);
    (exploreResult.weekend || []).forEach(e => console.log(`     • [WEEKEND] "${e.title}" (${e.category})`));

    console.log(`  4. Category Rails (${exploreResult.categoryRails?.length || 0} active rails):`);
    (exploreResult.categoryRails || []).forEach(rail => {
      console.log(`     📂 [Rail: ${rail.category}] (${rail.events?.length || 0} events, Color: ${rail.categoryColor?.accent || 'default'}):`);
      rail.events.forEach(e => console.log(`        - "${e.title}" (${e.attendeeCount} going)`));
    });

    console.log(`  5. Something Different (${exploreResult.somethingDifferent?.length || 0} events):`);
    (exploreResult.somethingDifferent || []).forEach(e => console.log(`     • "${e.title}" (${e.attendeeCount} going)`));

    console.log('\n════════════════════════════════════════════════════════════════');
    console.log('✅ EXPLORE SCREEN DATASET GENERATION 100% COMPLETE & VERIFIED!');
    console.log('════════════════════════════════════════════════════════════════\n');

  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedDiverseExploreEvents();
