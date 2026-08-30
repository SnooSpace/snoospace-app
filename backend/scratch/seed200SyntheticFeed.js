'use strict';
/**
 * 200 Synthetic Posts Feed Seeder
 * 
 * Creates a rich, realistic synthetic feed of ~200 total posts across 6 distinct types:
 * - 35 Events
 * - 33 Opportunities
 * - 33 Polls
 * - 33 Prompts
 * - 33 Challenges
 * - 33 Editorial Post Cards
 * 
 * Authored by 10 Synthetic Communities and 15 Synthetic Members (~8 posts per entity average).
 * Timestamps range from today to 30 days ago, with dynamic deadlines and active engagement.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createPool } = require('../config/db');

// ── Synthetic Data Definitions ───────────────────────────────────────────────

const COMMUNITIES_DATA = [
  {
    name: 'Tech & AI Guild',
    username: 'tech_ai_guild',
    email: 'community_tech_ai@snoospace.dev',
    bio: 'Pioneering artificial intelligence, machine learning, and next-gen software architectures in Bangalore.',
    category: 'Technology & AI',
    categories: ['Technology', 'AI', 'Coding'],
    location: 'Bangalore, India',
    logo_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800'
  },
  {
    name: 'Fitness & Run Club',
    username: 'fitness_run_club',
    email: 'community_fitness_run@snoospace.dev',
    bio: 'Bangalore’s premier community for runners, triathletes, and functional fitness enthusiasts.',
    category: 'Fitness & Sports',
    categories: ['Fitness', 'Running', 'Outdoors'],
    location: 'Bangalore, India',
    logo_url: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800'
  },
  {
    name: 'Underground Music Lab',
    username: 'music_lab_blr',
    email: 'community_music_lab@snoospace.dev',
    bio: 'Exploring electronic, indie, synthwave, and underground soundscapes.',
    category: 'Music & Nightlife',
    categories: ['Music', 'Nightlife', 'Arts'],
    location: 'Bangalore, India',
    logo_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800'
  },
  {
    name: 'Startup Grind BLR',
    username: 'startup_grind_blr',
    email: 'community_startup_grind@snoospace.dev',
    bio: 'Empowering founders, builders, and early-stage innovators through monthly pitches and mentorship.',
    category: 'Startups & Business',
    categories: ['Startups', 'Business', 'Networking'],
    location: 'Bangalore, India',
    logo_url: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800'
  },
  {
    name: 'UI/UX Craft Collective',
    username: 'uiux_craft',
    email: 'community_uiux_craft@snoospace.dev',
    bio: 'Crafting pixel-perfect design systems, product micro-interactions, and visual storytelling.',
    category: 'Design & UI/UX',
    categories: ['Design', 'UI/UX', 'Product'],
    location: 'Bangalore, India',
    logo_url: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800'
  },
  {
    name: 'Indie Film Society',
    username: 'indie_film_society',
    email: 'community_indie_film@snoospace.dev',
    bio: 'Screening independent cinema, documentary labs, and cinematography workshops.',
    category: 'Cinema & Arts',
    categories: ['Movies', 'Art & Culture', 'Photography'],
    location: 'Bangalore, India',
    logo_url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800'
  },
  {
    name: 'Culinary Explorers',
    username: 'culinary_explorers',
    email: 'community_culinary@snoospace.dev',
    bio: 'Celebrating artisanal pop-up dinners, specialty coffee tastings, and street food trails.',
    category: 'Food & Culinary',
    categories: ['Food & Drink', 'Travel', 'Lifestyle'],
    location: 'Bangalore, India',
    logo_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800'
  },
  {
    name: 'Esports & Gaming Lounge',
    username: 'esports_lounge',
    email: 'community_esports@snoospace.dev',
    bio: 'Competitive gaming tournaments, LAN parties, game dev showcases, and stream nights.',
    category: 'Gaming & Esports',
    categories: ['Gaming', 'Technology', 'Community'],
    location: 'Bangalore, India',
    logo_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800'
  },
  {
    name: 'Outdoor Adventure Club',
    username: 'outdoor_adventures',
    email: 'community_outdoors@snoospace.dev',
    bio: 'Western Ghats trekking, bouldering, stargazing camping trips, and eco-conservation.',
    category: 'Outdoors & Travel',
    categories: ['Outdoors', 'Travel', 'Fitness'],
    location: 'Bangalore, India',
    logo_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800'
  },
  {
    name: 'Product Management Guild',
    username: 'pm_guild_india',
    email: 'community_pm_guild@snoospace.dev',
    bio: 'Product teardowns, growth loops, metric frameworks, and PM leadership roundtables.',
    category: 'Product & Strategy',
    categories: ['Technology', 'Business', 'Networking'],
    location: 'Bangalore, India',
    logo_url: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=800'
  }
];

const MEMBERS_DATA = [
  { name: 'Aarav Sharma', username: 'aarav_dev', email: 'member_aarav@snoospace.dev', gender: 'Male', bio: 'Building distributed systems @ Scale. Open-source advocate.', photo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800' },
  { name: 'Ananya Mishra', username: 'ananya_design', email: 'member_ananya@snoospace.dev', gender: 'Female', bio: 'Senior Product Designer @ Stripe. Typography & motion lover.', photo_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800' },
  { name: 'Kabir Joshi', username: 'kabir_photo', email: 'member_kabir@snoospace.dev', gender: 'Male', bio: 'Street & architectural photographer. 35mm film shooter.', photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800' },
  { name: 'Diya Patel', username: 'diya_fitness', email: 'member_diya@snoospace.dev', gender: 'Female', bio: 'Sub-3 hour marathon runner. Functional movement enthusiast.', photo_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800' },
  { name: 'Rohan Verma', username: 'rohan_ai', email: 'member_rohan@snoospace.dev', gender: 'Male', bio: 'AI researcher working on multimodal LLMs and robotics.', photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800' },
  { name: 'Isha Gupta', username: 'isha_films', email: 'member_isha@snoospace.dev', gender: 'Female', bio: 'Independent documentary filmmaker & colorist.', photo_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800' },
  { name: 'Vikram Malhotra', username: 'vikram_m', email: 'member_vikram@snoospace.dev', gender: 'Male', bio: 'Early-stage angel investor & 2x founder.', photo_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=800' },
  { name: 'Navya Nair', username: 'navya_nair', email: 'member_navya@snoospace.dev', gender: 'Female', bio: 'UX Writer & Brand Strategist. Coffee geek ☕', photo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800' },
  { name: 'Dev Bhatia', username: 'dev_bhatia', email: 'member_dev@snoospace.dev', gender: 'Male', bio: 'React Native & iOS developer building fluid interfaces.', photo_url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=800' },
  { name: 'Riya Saxena', username: 'riya_music', email: 'member_riya@snoospace.dev', gender: 'Female', bio: 'Electronic music producer & Modular synth enthusiast.', photo_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800' },
  { name: 'Nikhil Deshmukh', username: 'nikhil_d', email: 'member_nikhil@snoospace.dev', gender: 'Male', bio: 'Lead PM @ Growth startup. Product teardown author.', photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800' },
  { name: 'Meera Iyer', username: 'meera_iyer', email: 'member_meera@snoospace.dev', gender: 'Female', bio: 'Pastry chef & food stylist documenting South Asian flavors.', photo_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800' },
  { name: 'Siddharth Rao', username: 'siddharth_r', email: 'member_siddharth@snoospace.dev', gender: 'Male', bio: '3D Artist & Unreal Engine game developer.', photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800' },
  { name: 'Tanvi Kapoor', username: 'tanvi_k', email: 'member_tanvi@snoospace.dev', gender: 'Female', bio: 'Community architect & event producer.', photo_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800' },
  { name: 'Reyansh Singh', username: 'reyansh_s', email: 'member_reyansh@snoospace.dev', gender: 'Male', bio: 'Cybersecurity analyst & ethical hacker.', photo_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=800' }
];

// Helper to get random date between startDaysAgo and endDaysAgo
function getRandomTimestamp(startDaysAgo, endDaysAgo) {
  const now = Date.now();
  const startMs = now - (startDaysAgo * 24 * 60 * 60 * 1000);
  const endMs = now - (endDaysAgo * 24 * 60 * 60 * 1000);
  const randomMs = startMs + Math.random() * (endMs - startMs);
  return new Date(randomMs);
}

// ── Main Seeding Function ───────────────────────────────────────────────────

async function seedSyntheticFeed() {
  const pool = createPool();
  console.log('================================================================');
  console.log('🌱 Starting Synthetic Feed Seeding (~200 Posts)');
  console.log('================================================================\n');

  try {
    // Clean partial posts created from previous attempt
    await pool.query(`DELETE FROM posts WHERE author_type = 'community' AND author_id IN (SELECT id FROM communities WHERE email LIKE 'community_%@snoospace.dev')`);
    await pool.query(`DELETE FROM events WHERE community_id IN (SELECT id FROM communities WHERE email LIKE 'community_%@snoospace.dev')`);
    await pool.query(`DELETE FROM opportunities`);

    // 1. Insert 10 Synthetic Communities
    console.log('[1/7] Seeding 10 Synthetic Communities...');
    const communityIds = [];
    for (const c of COMMUNITIES_DATA) {
      const existing = await pool.query(`SELECT id FROM communities WHERE email = $1 OR username = $2`, [c.email, c.username]);
      if (existing.rows.length > 0) {
        communityIds.push(existing.rows[0].id);
      } else {
        const res = await pool.query(`
          INSERT INTO communities (name, username, email, phone, bio, category, categories, location, sponsor_types, logo_url)
          VALUES ($1, $2, $3, '9876543210', $4, $5, $6::jsonb, $7, '[]'::jsonb, $8)
          RETURNING id
        `, [c.name, c.username, c.email, c.bio, c.category, JSON.stringify(c.categories), c.location, c.logo_url]);
        communityIds.push(res.rows[0].id);
      }
    }
    console.log(`   Created/Loaded ${communityIds.length} community records.`);

    // 2. Insert 15 Synthetic Members
    console.log('[2/7] Seeding 15 Synthetic Members...');
    const memberIds = [];
    for (const m of MEMBERS_DATA) {
      const existing = await pool.query(`SELECT id FROM members WHERE email = $1 OR username = $2`, [m.email, m.username]);
      if (existing.rows.length > 0) {
        memberIds.push(existing.rows[0].id);
      } else {
        const res = await pool.query(`
          INSERT INTO members (name, username, email, phone, dob, gender, interests, bio, profile_photo_url)
          VALUES ($1, $2, $3, '9900000000', '1998-05-15', $4, '["Technology", "Music", "Fitness", "Design"]'::jsonb, $5, $6)
          RETURNING id
        `, [m.name, m.username, m.email, m.gender, m.bio, m.photo_url]);
        memberIds.push(res.rows[0].id);
      }
    }
    console.log(`   Created/Loaded ${memberIds.length} member records.`);

    // 3. Establish Follow Connections (~400 follows)
    console.log('[3/7] Generating Follow connections...');
    // Real dev member ID 51 ("Harshith S Gowda")
    const realDevMemberId = 51;
    // Auto-follow real dev member to all synthetic communities & vice versa
    for (const cId of communityIds) {
      await pool.query(`
        INSERT INTO follows (follower_id, follower_type, following_id, following_type)
        VALUES ($1, 'member', $2, 'community')
        ON CONFLICT DO NOTHING
      `, [realDevMemberId, cId]);
    }
    for (const mId of memberIds) {
      await pool.query(`
        INSERT INTO follows (follower_id, follower_type, following_id, following_type)
        VALUES ($1, 'member', $2, 'member')
        ON CONFLICT DO NOTHING
      `, [realDevMemberId, mId]);

      // Cross-follow between synthetic members & communities
      for (const cId of communityIds.slice(0, 5)) {
        await pool.query(`
          INSERT INTO follows (follower_id, follower_type, following_id, following_type)
          VALUES ($1, 'member', $2, 'community')
          ON CONFLICT DO NOTHING
        `, [mId, cId]);
      }
    }
    console.log(`   Follow graph connected.`);

    // 4. Generate 35 Events
    console.log('[4/7] Generating 35 Events & Event Promos...');
    const eventTitles = [
      'Bangalore AI Summit 2026: LLMs in Production',
      'Underground Electronic Music Night & Live Synth Lab',
      'Koramangala 10K Sunrise Run & Recovery Breakfast',
      'Indie Film Pitch & Short Film Showcase',
      'UI/UX Design Systems Workshop: Tokens & Micro-Interactions',
      'Startup Founders & Pitch Practice Roundtable',
      'Specialty Coffee Cupping & Artisanal Pastry Trail',
      'Valorant & CS2 Community Tournament Final',
      'Nandi Hills Night Bouldering & Stargazing Camp',
      'Product Growth Loops & Metric Teardown Masterclass',
      'Generative AI Hackathon: Building Autonomous Agents',
      'Midnight Cycling Expedition through Cubbon Park',
      'Analog Photography & Darkroom Printing Lab',
      'Rooftop Acoustic Session & Open Mic Night',
      'Fintech Founders Meetup: Cross-Border Payments',
      'Cybersecurity CTF (Capture The Flag) Tournament',
      'Design Sprint 101: From Concept to Interactive Prototype',
      'Artisanal Sourdough & Craft Beer Tasting',
      'Game Dev Showcase: Unreal Engine 5 Graphics Demo',
      'Western Ghats Trekking & Waterfalls Trail',
      'Product Strategy Teardown: Uber vs Grab UX',
      'Sub-Bass & Synthwave DJ Set by SoundLab',
      'Women in Tech & Leadership Panel Discussion',
      'Marathon Training: Pace Strategy & Hydration',
      'Documentary Editing Masterclass with DaVinci Resolve',
      'Neovim & Terminal Productivity Workflows',
      'Cocktail Mixology & Asian Street Food Pop-up',
      'Speed Networking for Founders & Engineers',
      'Bouldering Basics & Safety Clinic',
      'Figma Variables & Advanced Auto Layout 5.0',
      'AI Music Generation & Digital Audio Workstations',
      'Sunset Yoga & Sound Bath Healing Session',
      'Indie Game Pitch & Publisher Q&A',
      'Clean Code & Refactoring Legacy Codebases',
      'Coffee & Code Saturday Morning Build Session'
    ];

    const eventBannerPool = [
      'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200',
      'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200',
      'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200',
      'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1200',
      'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200',
      'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1200',
      'https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=1200',
      'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200'
    ];

    for (let i = 0; i < 35; i++) {
      const commId = communityIds[i % communityIds.length];
      const title = eventTitles[i];
      const createdAt = getRandomTimestamp(0.1, 28);
      // Event date: mix of upcoming (1-25 days ahead) and past (1-4 days ago)
      const isPast = i % 7 === 0;
      const eventDate = isPast 
        ? getRandomTimestamp(-4, -1) 
        : new Date(Date.now() + ((i + 1) * 0.8 * 24 * 60 * 60 * 1000));
      
      const bannerUrl = eventBannerPool[i % eventBannerPool.length];
      const ticketPrice = (i % 3 === 0) ? 0 : 299 + (i * 50);

      // Insert into events table
      const evRes = await pool.query(`
        INSERT INTO events (
          community_id, title, description, event_date, location, location_name,
          max_attendees, ticket_price, banner_url, created_at, created_by, event_type
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $1, 'in-person')
        RETURNING id
      `, [
        commId, title, `${title} - Join us for an immersive community experience! Network with creators, experts, and enthusiasts.`,
        eventDate, 'Indiranagar / HSR Layout, Bangalore', 'SnooSpace Hub Studio',
        100, ticketPrice, bannerUrl, createdAt
      ]);
      const eventId = evRes.rows[0].id;

      // Insert corresponding post (event_promo)
      await pool.query(`
        INSERT INTO posts (author_id, author_type, caption, post_type, type_data, image_urls, created_at)
        VALUES ($1, 'community', $2, 'event_promo', $3::jsonb, $4::jsonb, $5)
      `, [
        commId, `🎉 Upcoming Event: ${title}`,
        JSON.stringify({ event_id: eventId, event_date: eventDate, ticket_price: ticketPrice, banner_url: bannerUrl }),
        JSON.stringify([bannerUrl]), createdAt
      ]);

      // Insert ticket types
      await pool.query(`
        INSERT INTO ticket_types (event_id, name, base_price, total_quantity, sold_count)
        VALUES ($1, 'General Admission', $2, 100, $3)
      `, [eventId, ticketPrice, Math.floor(Math.random() * 40) + 10]);
    }
    console.log('   35 Events created.');

    // 5. Generate 33 Opportunities
    console.log('[5/7] Generating 33 Opportunities...');
    const oppTitles = [
      'Senior React Native Engineer (Mobile Lead)',
      'Lead UI/UX Designer - Design Systems',
      'AI / ML Research Fellow (Multimodal LLMs)',
      'Full Stack Developer (Next.js & Node.js)',
      'Community Growth & Content Manager',
      'Videographer & Video Editor (Reels & Shorts)',
      'DevOps & Kubernetes Infrastructure Specialist',
      'Brand & Graphic Designer',
      'Backend Engineer (Golang & PostgreSQL)',
      'Product Management Intern (Summer 2026)',
      'Technical Content Writer & Developer Educator',
      'Cybersecurity Penetration Tester',
      'Unreal Engine 3D Environment Artist',
      'Event Operations & Host Coordinator',
      'Data Engineer (Spark & Snowflake)',
      'Frontend Performance Specialist',
      'Audio Engineer & Sound Designer',
      'Social Media Strategist & Creator Lead',
      'Flutter Mobile Application Developer',
      'QA Automation Engineer (Cypress & Playwright)',
      'Growth Hacker & Performance Marketer',
      'Micro-Services Architect',
      'Motion Designer & Animator',
      'DevRel & Developer Experience Advocate',
      'Site Reliability Engineer (SRE)',
      'Figma Plugin & Tooling Developer',
      'Database Reliability Engineer (DBA)',
      'Copywriter & Storyteller',
      'iOS Swift Lead Developer',
      'System Administrator & Linux Specialist',
      'Junior UI Designer (Figma Focus)',
      'AI Ethics & Safety Researcher',
      'Product Operations Analyst'
    ];

    for (let i = 0; i < 33; i++) {
      const commId = communityIds[i % communityIds.length];
      const title = oppTitles[i];
      const createdAt = getRandomTimestamp(0.2, 25);
      
      // Expiry / closing dates:
      // Active: expires in 3-14 days (or urgent 18h), closed_at = NULL, status = 'active'
      // Closed: closed 2 days ago, status = 'closed', closed_at = date
      const isClosed = i % 6 === 0;
      const isUrgent = i % 5 === 0;
      const expiresAt = isClosed
        ? new Date(Date.now() - (2 * 24 * 60 * 60 * 1000))
        : isUrgent
          ? new Date(Date.now() + (18 * 60 * 60 * 1000))
          : new Date(Date.now() + ((i + 3) * 24 * 60 * 60 * 1000));
      const closedAt = isClosed ? expiresAt : null;
      const status = isClosed ? 'closed' : 'active';

      const oppType = (i % 3 === 0) ? 'internship' : (i % 3 === 1) ? 'full-time' : 'freelance';
      const stipend = 25000 + (i * 2000);

      const oppRes = await pool.query(`
        INSERT INTO opportunities (
          title, creator_id, creator_type, status, opportunity_types, work_type, work_mode,
          experience_level, availability, turnaround, payment_type, budget_range, payment_nature,
          visibility, expires_at, closed_at, created_at, about_role, responsibilities, who_can_apply, gains
        )
        VALUES (
          $1, $2, 'community', $3, ARRAY[$4], 'one_time', 'remote',
          'any', 'Immediate', '2 weeks', 'fixed', $5, 'paid',
          'public', $6, $7, $8, $9, $10::text[], $11::text[], $12::text[]
        )
        RETURNING id
      `, [
        title, String(commId), status, oppType, `₹${stipend.toLocaleString()}/mo`,
        expiresAt, closedAt, createdAt, `${title} - Join our high-impact team to build cutting-edge products. Great culture and growth!`,
        ['Design and ship production features', 'Collaborate with cross-functional teams', 'Review code and mentor peers'],
        ['Designers & Developers with strong portfolios', 'Experience with modern tech stacks', 'College students & early pros welcome'],
        ['Competitive stipend', 'Flexible work hours', 'Certificate & Recommendation letter']
      ]);
      const oppId = oppRes.rows[0].id;

      // Corresponding post (opportunity)
      await pool.query(`
        INSERT INTO posts (author_id, author_type, caption, post_type, type_data, image_urls, created_at)
        VALUES ($1, 'community', $2, 'opportunity', $3::jsonb, '[]'::jsonb, $4)
      `, [
        commId, `💼 We're hiring: ${title}`,
        JSON.stringify({ opportunity_id: oppId, title: title, stipend: `₹${stipend.toLocaleString()}/mo`, closed_at: closedAt }),
        createdAt
      ]);
    }
    console.log('   33 Opportunities created.');

    // 6. Generate 33 Polls
    console.log('[6/7] Generating 33 Polls...');
    const pollQuestions = [
      'Which framework are you using for your next startup MVP?',
      'What is your primary mobile development target in 2026?',
      'How many hours do you code / design per day on average?',
      'Which AI coding assistant has given you the highest productivity boost?',
      'Preferred state management tool for React Native apps?',
      'What is your team’s primary CI/CD platform?',
      'Which database powers your main production workload?',
      'Remote work vs Hybrid vs Office: What is your ideal setup?',
      'How often do you refactor legacy codebases in your sprint?',
      'Which UI component library do you rely on for web apps?',
      'Best time of day for deep focus work?',
      'How do you manage design tokens in your team?',
      'Which cloud provider do you deploy your backends to?',
      'What is your top metric when evaluating app performance?',
      'Do you prefer TypeScript strict mode enabled by default?',
      'Which testing framework do you use for frontend E2E tests?',
      'How many browser tabs do you currently have open?',
      'Preferred IDE color theme in 2026?',
      'Which backend language is your go-to for microservices?',
      'How do you handle API client caching in mobile apps?',
      'What is the biggest bottleneck in your current development workflow?',
      'How often do you read technical books or whitepapers?',
      'Which CSS approach do you use for complex layouts?',
      'Do you use AI for generating UI mockups?',
      'What is your favourite coffee brewing method for late nights?',
      'How many side projects have you shipped this year?',
      'Which version control workflow does your team follow?',
      'How do you handle feature flags in mobile releases?',
      'What is your primary source for tech news & discussions?',
      'Which API architecture do you prefer for new projects?',
      'Do you write unit tests before writing feature code (TDD)?',
      'What is your top priority when choosing a new tech stack?',
      'How do you track mobile app crashes in production?'
    ];

    const pollOptionSets = [
      ['Next.js 15', 'Vite + React', 'Flutter', 'React Native'],
      ['Expo / React Native', 'Native Swift/Kotlin', 'Flutter', 'Web PWA'],
      ['2-4 hours', '4-6 hours', '6-8 hours', '8+ hours'],
      ['Claude / Gemini', 'GitHub Copilot', 'Cursor', 'Custom Ollama']
    ];

    for (let i = 0; i < 33; i++) {
      const isMemberAuthor = i % 2 === 0;
      const authorId = isMemberAuthor ? memberIds[i % memberIds.length] : communityIds[i % communityIds.length];
      const authorType = isMemberAuthor ? 'member' : 'community';
      const createdAt = getRandomTimestamp(0.1, 29);
      const expiresAt = new Date(Date.now() + ((i % 5 + 1) * 2 * 24 * 60 * 60 * 1000));
      const question = pollQuestions[i];
      const options = pollOptionSets[i % pollOptionSets.length];
      const votes = [45 + (i * 3), 28 + (i * 2), 19 + i, 34 + (i * 4)];
      const totalVotes = votes.reduce((a, b) => a + b, 0);

      const postRes = await pool.query(`
        INSERT INTO posts (author_id, author_type, caption, post_type, type_data, image_urls, expires_at, created_at)
        VALUES ($1, $2, $3, 'poll', $4::jsonb, '[]'::jsonb, $5, $6)
        RETURNING id
      `, [
        authorId, authorType, `📊 ${question}`,
        JSON.stringify({ question, options, votes, total_votes: totalVotes }),
        expiresAt, createdAt
      ]);
      const postId = postRes.rows[0].id;

      // Add vote records in poll_votes table
      for (let v = 0; v < 5; v++) {
        const voterId = memberIds[(i + v) % memberIds.length];
        await pool.query(`
          INSERT INTO poll_votes (post_id, voter_id, voter_type, option_index)
          VALUES ($1, $2, 'member', $3)
          ON CONFLICT DO NOTHING
        `, [postId, voterId, v % options.length]);
      }
    }
    console.log('   33 Polls created with vote tallies.');

    // 7. Generate 33 Prompts
    console.log('[7/7] Generating 33 Prompts...');
    const promptTexts = [
      'What is the single most valuable lesson you learned from a failed project?',
      'Show us your workspace setup! Post a photo of your desk below 📸',
      'What is one technical myth you wish engineers would stop believing?',
      'Share your favorite productivity hack that saved you 5+ hours this week.',
      'What was the first line of code or design work you ever got paid for?',
      'What is your go-to song or album when you need intense deep focus?',
      'If you could rewrite one major software library from scratch, which one?',
      'What is the most underrated open-source tool you use daily?',
      'Share a screenshot of your terminal / shell customizations!',
      'What is your advice for junior engineers starting out in 2026?',
      'What is one feature you built that you are most proud of?',
      'How do you prevent burn-out during high-pressure launch weeks?',
      'What is the funniest bug you ever encountered in production?',
      'Share your favorite book recommendation for tech builders.',
      'What is one design detail in everyday apps that delights you?',
      'What is your take on AI-generated code quality in production?',
      'What is your favorite community event memory from this year?',
      'Share a code snippet or visual layout you worked on today!',
      'What is the best career advice you ever received from a mentor?',
      'How do you stay motivated when stuck on a tough bug for days?',
      'What is your favorite UI animation or micro-interaction in any app?',
      'Share your favorite keyboard shortcuts that changed your workflow.',
      'What is one skill outside of coding that made you a better developer?',
      'What is your prediction for mobile development in the next 3 years?',
      'Share a photo of your favorite coffee shop work spot ☕',
      'What is the hardest architectural decision you had to make recently?',
      'How do you explain your job to family members who aren’t in tech?',
      'What is your favorite debugging tool or technique?',
      'Share your favorite podcast for design & engineering insights.',
      'What is one habit that improved your daily focus the most?',
      'What is your dream side-project if you had 1 month of zero obligations?',
      'How do you structure your personal knowledge base & notes?',
      'What is the best tech gift under ₹5,000 you ever bought?'
    ];

    const gradients = [
      ['#4F46E5', '#7C3AED'],
      ['#059669', '#10B981'],
      ['#D97706', '#F59E0B'],
      ['#DC2626', '#EF4444'],
      ['#2563EB', '#3B82F6']
    ];

    for (let i = 0; i < 33; i++) {
      const isMemberAuthor = i % 2 === 1;
      const authorId = isMemberAuthor ? memberIds[i % memberIds.length] : communityIds[i % communityIds.length];
      const authorType = isMemberAuthor ? 'member' : 'community';
      const createdAt = getRandomTimestamp(0.1, 28);
      const text = promptTexts[i];

      const postRes = await pool.query(`
        INSERT INTO posts (author_id, author_type, caption, post_type, type_data, image_urls, created_at)
        VALUES ($1, $2, $3, 'prompt', $4::jsonb, '[]'::jsonb, $5)
        RETURNING id
      `, [
        authorId, authorType, `💬 Prompt of the Day`,
        JSON.stringify({
          prompt_text: text,
          prompt_category: 'Community Discussion',
          background_gradient: gradients[i % gradients.length],
          response_count: 8 + i
        }),
        createdAt
      ]);
      const postId = postRes.rows[0].id;

      // Add prompt submissions
      for (let s = 0; s < 2; s++) {
        const subAuthorId = memberIds[(i + s + 1) % memberIds.length];
        await pool.query(`
          INSERT INTO prompt_submissions (post_id, author_id, author_type, content)
          VALUES ($1, $2, 'member', $3)
        `, [postId, subAuthorId, `Great prompt! In my experience with ${text.slice(0, 15)}, consistency and testing early made all the difference.`]);
      }
    }
    console.log('   33 Prompts created.');

    // 8. Generate 33 Challenges
    console.log('[8/7] Generating 33 Challenges...');
    const challengeTitles = [
      '30-Day Code & Commit Challenge 🚀',
      '7-Day Figma UI Design Sprint 🎨',
      '10,000 Steps Daily Fitness Streak 🏃‍♂️',
      'Daily Short Film / Reels Challenge 🎬',
      '14-Day Open Source Contribution Quest 💻',
      '100 Days of Code: Build in Public 🏗️',
      'Artisanal Coffee Brewing Photo Log ☕',
      'Clean Code Refactoring Sprint 🧹',
      '30-Day Morning Meditation & Journaling 🧘‍♀️',
      'Indie Game Asset Design Challenge 👾',
      'Cybersecurity CTF Weekly Quest 🛡️',
      'Typography & Poster Design Daily ✍️',
      '10-Day Full-Stack MVP Sprint ⏱️',
      'Outdoor Bouldering & Trek Log 🧗',
      '30-Day Reading & Teardown Streak 📚',
      'Daily Micro-Interaction Animation ⚡',
      'Synthwave Beat-a-Day Challenge 🎵',
      'Product Metric Teardown Challenge 📊',
      '7-Day Healthy Meal Prep Streak 🥗',
      'Docker & K8s Container Quest 🐳',
      'Street Photography 7-Day Essay 📷',
      'Neovim Config Optimization Sprint ⌨️',
      'Generative AI Prompt Design Contest 🤖',
      '10-Day Hydration & Sleep Optimization 💧',
      'Flutter UI Component Recreation 📱',
      'Darkroom Film Editing Quest 🎞️',
      'No-Code Workflow Build Challenge 🛠️',
      '30-Day Morning Run Streak 👟',
      'Design Token Standardization Sprint 🎨',
      'API Security Hardening Quest 🔐',
      'Indie Founder Pitch Polish 🎤',
      '3D Low-Poly Character Modeling 🧊',
      'Speed Reading Tech Papers Sprint 📄'
    ];

    for (let i = 0; i < 33; i++) {
      const commId = communityIds[i % communityIds.length];
      const title = challengeTitles[i];
      const createdAt = getRandomTimestamp(0.1, 30);
      const endDate = new Date(Date.now() + ((i + 2) * 24 * 60 * 60 * 1000));

      const postRes = await pool.query(`
        INSERT INTO posts (author_id, author_type, caption, post_type, type_data, image_urls, expires_at, created_at)
        VALUES ($1, 'community', $2, 'challenge', $3::jsonb, '[]'::jsonb, $4, $5)
        RETURNING id
      `, [
        commId, `⚡ Community Challenge: ${title}`,
        JSON.stringify({
          title,
          description: `Join the ${title}! Push your boundaries, track your daily progress, and win exclusive creator badges and perks.`,
          reward: 'Verified Creator Badge + SnooSpace Spotlight',
          participant_count: 15 + (i * 2),
          end_date: endDate,
          rules: ['Post daily updates', 'Tag the community', 'Support fellow challengers']
        }),
        endDate, createdAt
      ]);
      const postId = postRes.rows[0].id;

      // Add challenge participations
      for (let p = 0; p < 3; p++) {
        const partId = memberIds[(i + p) % memberIds.length];
        await pool.query(`
          INSERT INTO challenge_participations (post_id, participant_id, participant_type, status)
          VALUES ($1, $2, 'member', 'joined')
          ON CONFLICT DO NOTHING
        `, [postId, partId]);
      }
    }
    console.log('   33 Challenges created.');

    // 9. Generate 33 Editorial Post Cards (Media Posts)
    console.log('[9/7] Generating 33 Editorial Media Posts...');
    const editorialCaptions = [
      'Late night build session on the new architecture. Quiet hours, fast code, and zero distractions. 🌙⚡',
      'Golden hour captured right outside our Indiranagar studio today. Bangalore weather never fails to inspire. ✨📷',
      'Exploratory UI design concepts for spatial computing interfaces. Focused on fluid gestures and soft shadows.',
      'Weekend vibes with the runner community! 12km done at Cubbon Park. Grateful for this morning energy. 🏃‍♀️🌿',
      'Synthwave studio session in full swing. Testing out analog filters and classic drum machines. 🎵🎛️',
      'Highlights from yesterday’s Startup Pitch Night! 8 incredible founders showcased their early MVPs. 🚀',
      'Behind the scenes of our indie documentary shoot in the Western Ghats. Raw footage looks magical. 🎥🍃',
      'Artisanal coffee cupping session this morning. Exploring light roasts from Chikmagalur. ☕✨',
      'Unreal Engine 5 lighting test for our upcoming indie game level. Volumetric fog adds so much mood!',
      'Deep dive into micro-interactions and spring physics in React Native. Smooth 60fps animations feel amazing.',
      'Bouldering session at Nandi Hills. Sunsets hit different from up here. 🧗‍♂️🌅',
      'Figma design system token architecture preview. Standardizing colors, spacing, and typography across 4 apps.',
      'Late night code review complete! Cleaned up 1,200 lines of legacy queries. Nothing feels better than negative line counts.',
      'Specialty sourdough & coffee pop-up prep in progress. Fresh out of the oven! 🍞🥖',
      'CS2 Community Cup finals were intense tonight! GG to all participants. 🎮🔥',
      'Architectural photography walk through Old Bangalore. History meets modern geometry.',
      'Refactoring state management using custom hooks. Code cleanliness is peaceful.',
      'Morning trail run through HSR lake grounds. Fresh air before diving into sprint backlog.',
      'Experimenting with generative shader art in WebGL. Math meets visual poetry.',
      'Filmmaking workshop highlights: Framing, color grading, and audio recording 101.',
      'Tech stack evolution: Lessons learned moving from monolith to event-driven microservices.',
      'Post-workout smoothie & planning tomorrow’s product roadmap. Stay balanced! 🥤',
      'Modular synth patch demo: Generative ambient textures for focus & coding background sound.',
      'Design critique session with the crew. Honest feedback makes product design so much stronger.',
      'Early morning trek to Skandagiri summit. Above the clouds! ☁️🌄',
      'Product growth breakdown: How smart onboarding loops double week-1 retention.',
      'Custom Neovim statusline & color scheme tweaks. Terminal aesthetics matter!',
      'Home brewed pourover coffee & Sunday morning reading list. ☕📖',
      'Trekking through rainforest trails in Coorg. Nature is the best reset button.',
      'Figma Auto Layout 5.0 masterclass notes. Responsive component design made effortless.',
      'Late night bug hunt ended in victory! 1 line fix solved 3 days of mystery crashes.',
      'Community meet & greet at the workspace! Loving the energy from all builders.',
      'Sunset views from the studio rooftop after a productive week. Cheers to the weekend! 🌆'
    ];

    const imagePool = [
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1000',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1000',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1000',
      'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=1000',
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=1000',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=1000',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=1000',
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=1000'
    ];

    for (let i = 0; i < 33; i++) {
      const isMember = i % 2 === 0;
      const authorId = isMember ? memberIds[i % memberIds.length] : communityIds[i % communityIds.length];
      const authorType = isMember ? 'member' : 'community';
      const createdAt = getRandomTimestamp(0.1, 30);
      const caption = editorialCaptions[i];

      // Multi-image carousel for some posts
      const imgCount = (i % 3 === 0) ? 2 : (i % 5 === 0) ? 3 : 1;
      const images = [];
      for (let imgIdx = 0; imgIdx < imgCount; imgIdx++) {
        images.push(imagePool[(i + imgIdx) % imagePool.length]);
      }

      await pool.query(`
        INSERT INTO posts (author_id, author_type, caption, post_type, image_urls, aspect_ratios, type_data, created_at, like_count, comment_count)
        VALUES ($1, $2, $3, 'media', $4::jsonb, '[1.0]'::jsonb, $5::jsonb, $6, $7, $8)
      `, [
        authorId, authorType, caption,
        JSON.stringify(images),
        JSON.stringify({ image_urls: images, aspect_ratios: [1.0] }),
        createdAt,
        Math.floor(Math.random() * 45) + 5,
        Math.floor(Math.random() * 15) + 2
      ]);
    }
    console.log('   33 Editorial Media Posts created.');

    console.log('\n================================================================');
    console.log('🎉 Synthetic Feed Seeding Completed Successfully!');
    console.log('   Summary: 10 Communities, 15 Members, 200 Total Posts');
    console.log('================================================================\n');

  } catch (err) {
    console.error('❌ Error during seeding:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  seedSyntheticFeed();
}

module.exports = { seedSyntheticFeed };
