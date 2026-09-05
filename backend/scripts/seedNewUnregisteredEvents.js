'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createPool } = require('../config/db');

async function seedNewUnregisteredEvents() {
  const pool = createPool();
  console.log('================================================================');
  console.log('🌟 Seeding New Unregistered Synthetic Events');
  console.log('   - Free & Paid Ticket Types');
  console.log('   - Gender-Restricted Tickets (Male & Female)');
  console.log('   - Early Bird Pricing Rules & Promo Discount Codes');
  console.log('   - ZERO User Registrations');
  console.log('================================================================\n');

  try {
    // 1. Approve verification_status on synthetic communities so their zero-registration events display in Explore & Rails
    const communityUsernames = [
      'tech_ai_guild',
      'uiux_craft',
      'founders_hub_blr',
      'blr_music_collective',
      'culinary_blr',
      'urban_fit_blr',
      'adventure_ghats',
      'boardgame_esports_blr',
      'clay_pottery_blr',
      'snoospace'
    ];

    await pool.query(`
      UPDATE communities 
      SET verification_status = 'approved'
      WHERE username = ANY($1)
    `, [communityUsernames]);
    console.log('✓ Approved verification_status for synthetic communities.');

    // 2. Clean up dummy registrations on previously seeded synthetic events (events 42-62)
    // where users 51, 52, 155 were automatically registered by the old seed script
    const cleanedRegs = await pool.query(`
      DELETE FROM event_registrations
      WHERE member_id IN (51, 52, 155) AND event_id BETWEEN 42 AND 62
      RETURNING id, event_id, member_id
    `);
    console.log(`✓ Cleaned up ${cleanedRegs.rows.length} dummy event_registrations for users [51, 52, 155] from old synthetic events.`);

    // 3. Fetch community IDs
    const commRows = await pool.query(`SELECT id, username, name FROM communities WHERE username = ANY($1)`, [communityUsernames]);
    const commMap = new Map();
    commRows.rows.forEach(r => commMap.set(r.username, r.id));

    // 4. Fetch category IDs from discover_categories
    const catRows = await pool.query(`SELECT id, slug, name FROM discover_categories WHERE is_active = true`);
    const catMap = new Map();
    catRows.rows.forEach(r => catMap.set(r.slug, r.id));

    // Helper for future dates
    const now = Date.now();
    const daysFromNow = (days, hour = 18, minute = 0) => {
      const d = new Date(now + days * 24 * 60 * 60 * 1000);
      d.setHours(hour, minute, 0, 0);
      return d;
    };

    // 5. Definitions of the 8 brand-new synthetic events
    const newEvents = [
      // ──────────────────────────────────────────────────────────────────────────
      // Event 1: FREE TECH & AI HACKATHON with Male & Female Pass Tiers
      // ──────────────────────────────────────────────────────────────────────────
      {
        commUsername: 'tech_ai_guild',
        title: 'NextGen AI & Autonomous Agents Hackathon 2026',
        description: '48-hour sprint building production multi-agent systems, multimodal LLM pipelines, and on-device neural reasoning. Mentorship from lead researchers and cash pool.',
        location_name: 'Microsoft Reactor / SnooSpace Tech Hub, Bangalore',
        location_url: 'https://maps.google.com/?q=12.971598,77.594566',
        city: 'Bangalore',
        start_datetime: daysFromNow(4, 10, 0),
        end_datetime: daysFromNow(5, 18, 0),
        ticket_price: 0,
        categories: ['Technology', 'AI', 'Hackathon'],
        catSlugs: ['hackathons', 'skill-building-workshops'],
        banner_url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200',
        gallery_urls: [
          'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200',
          'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200'
        ],
        highlights: [
          { icon_name: 'award', title: '₹1,00,000 Prize Pool', description: 'Awarded to top 3 autonomous agent hacks' },
          { icon_name: 'zap', title: 'Free GPU Credits', description: '$500 cloud inference credits per team' },
          { icon_name: 'coffee', title: 'Food & Drinks Provided', description: 'Continuous catering throughout the sprint' }
        ],
        things_to_know: [
          { icon_name: 'laptop', label: 'Bring your laptop & charger' },
          { icon_name: 'users', label: 'Teams of 2 to 4 or solo builders' },
          { icon_name: 'shield-check', label: 'Valid Govt ID required for entry' }
        ],
        ticket_types: [
          {
            name: 'General Developer Pass',
            description: 'Full weekend access for developers of all backgrounds',
            base_price: 0,
            gender_restriction: 'all',
            total_quantity: 100,
            display_order: 0
          },
          {
            name: 'Women in AI Fellow Pass',
            description: 'Reserved slot and dedicated mentorship for women technologists',
            base_price: 0,
            gender_restriction: 'Female',
            total_quantity: 40,
            display_order: 1
          },
          {
            name: 'Gentlemen Builder Pass',
            description: 'Standard hacker pass for male developers & engineers',
            base_price: 0,
            gender_restriction: 'Male',
            total_quantity: 60,
            display_order: 2
          }
        ],
        pricing_rules: [],
        discount_codes: []
      },

      // ──────────────────────────────────────────────────────────────────────────
      // Event 2: PAID SYNTHWAVE NEON RAVE (Gender-Restricted Tickets + Discounts)
      // ──────────────────────────────────────────────────────────────────────────
      {
        commUsername: 'blr_music_collective',
        title: 'Underground Neon Rave: Synthwave & Electro Lab',
        description: 'Immersive audio-visual rave featuring modular synthesizers, heavy analog sub-bass, and cyberpunk laser installations. Top electronic artists from Bangalore and Goa.',
        location_name: 'Fandom at Gillys Reloaded, Koramangala, Bangalore',
        location_url: 'https://maps.google.com/?q=12.934444,77.618611',
        city: 'Bangalore',
        start_datetime: daysFromNow(5, 20, 0),
        end_datetime: daysFromNow(6, 2, 0),
        ticket_price: 299,
        categories: ['Music & Concerts', 'Nightlife & Parties'],
        catSlugs: ['nightlife-parties', 'club-nights'],
        banner_url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200',
        gallery_urls: [
          'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1200',
          'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200'
        ],
        highlights: [
          { icon_name: 'music', title: '5 Live Synth DJ Sets', description: 'Darkwave, Electro, and Synthpop live performers' },
          { icon_name: 'sparkles', title: 'Cyberpunk Laser Stage', description: '360-degree reactive visual projection mapping' },
          { icon_name: 'glass', title: 'Complimentary Welcome Drink', description: '1 craft cocktail included with every entry pass' }
        ],
        things_to_know: [
          { icon_name: 'clock', label: 'Gates open at 8:00 PM • Curfew 2:00 AM' },
          { icon_name: 'shirt', label: 'Neon / Cyberpunk club wear encouraged' },
          { icon_name: 'alert-circle', label: 'Strictly 21+ age verification at entry' }
        ],
        ticket_types: [
          {
            name: 'Vixens & Ladies Pass',
            description: 'Exclusive ladies special entry with complimentary welcome cocktail',
            base_price: 299,
            gender_restriction: 'Female',
            total_quantity: 50,
            display_order: 0
          },
          {
            name: 'Stag Entry (Men Only)',
            description: 'Standard single entry pass for male attendees',
            base_price: 499,
            gender_restriction: 'Male',
            total_quantity: 60,
            display_order: 1
          },
          {
            name: 'Couple Entry Pass',
            description: 'Admit 2 guests (1 Male + 1 Female or same-gender pair)',
            base_price: 699,
            gender_restriction: 'all',
            total_quantity: 40,
            display_order: 2
          },
          {
            name: 'VIP Backstage All-Access',
            description: 'Green room access, DJ console view, and unlimited refreshments',
            base_price: 999,
            gender_restriction: 'all',
            total_quantity: 20,
            display_order: 3
          }
        ],
        pricing_rules: [
          {
            name: 'Early Bird Rave 20% Off',
            rule_type: 'early_bird_time',
            discount_type: 'percentage',
            discount_value: 20,
            valid_until: daysFromNow(3, 23, 59),
            priority: 1
          }
        ],
        discount_codes: [
          {
            code: 'NEON20',
            discount_type: 'percentage',
            discount_value: 20,
            max_uses: 100,
            valid_until: daysFromNow(5, 20, 0)
          },
          {
            code: 'LADIESNIGHT',
            discount_type: 'flat',
            discount_value: 100,
            max_uses: 50,
            valid_until: daysFromNow(5, 20, 0)
          }
        ]
      },

      // ──────────────────────────────────────────────────────────────────────────
      // Event 3: PAID FOUNDERS & INVESTOR SHOWCASE (Discounts + Gender Preferred)
      // ──────────────────────────────────────────────────────────────────────────
      {
        commUsername: 'founders_hub_blr',
        title: 'Bangalore Angel Pitch & Startup Showcase 2026',
        description: 'Exclusive gathering of 150+ founders, operators, and active angels. 10 curated pre-seed and seed startups pitch live on stage followed by private networking dinner.',
        location_name: 'WeWork Galaxy, Residency Road, Bangalore',
        location_url: 'https://maps.google.com/?q=12.973418,77.608034',
        city: 'Bangalore',
        start_datetime: daysFromNow(7, 16, 0),
        end_datetime: daysFromNow(7, 21, 0),
        ticket_price: 499,
        categories: ['Startups & Business', 'Networking'],
        catSlugs: ['networking-mixers'],
        banner_url: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=1200',
        gallery_urls: [
          'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200',
          'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200'
        ],
        highlights: [
          { icon_name: 'users', title: '25+ Active Angels in Attendance', description: 'Meet partners from Blume, Sequoia Surge, and angel syndicates' },
          { icon_name: 'briefcase', title: '10 Live Pitches', description: '5-minute pitches with rapid angel Q&A' },
          { icon_name: 'coffee', title: 'Artisanal Coffee & Dinner', description: 'Gourmet dinner buffet included' }
        ],
        things_to_know: [
          { icon_name: 'briefcase', label: 'Business casual or founder casual attire' },
          { icon_name: 'file-text', label: 'Deck submission required if pitching' },
          { icon_name: 'map-pin', label: 'Valet parking available at venue' }
        ],
        ticket_types: [
          {
            name: 'Founder General Pass',
            description: 'Admit one founder/operator to pitches & networking',
            base_price: 499,
            gender_restriction: 'all',
            total_quantity: 60,
            display_order: 0
          },
          {
            name: 'Female Founders VIP Pass',
            description: 'Subsidized pass supporting women entrepreneurs in venture building',
            base_price: 399,
            gender_restriction: 'Female',
            total_quantity: 30,
            display_order: 1
          },
          {
            name: 'Male Founders VIP Pass',
            description: 'Full-access pass for male founders and co-founders',
            base_price: 499,
            gender_restriction: 'Male',
            total_quantity: 40,
            display_order: 2
          },
          {
            name: 'Angel & Investor Pass',
            description: 'Reserved front-row pitch seating + founder contact book',
            base_price: 1299,
            gender_restriction: 'all',
            total_quantity: 25,
            display_order: 3
          }
        ],
        pricing_rules: [
          {
            name: 'Super Early Bird 25% Off',
            rule_type: 'early_bird_time',
            discount_type: 'percentage',
            discount_value: 25,
            valid_until: daysFromNow(4, 23, 59),
            priority: 1
          }
        ],
        discount_codes: [
          {
            code: 'STARTUP50',
            discount_type: 'percentage',
            discount_value: 50,
            max_uses: 30,
            valid_until: daysFromNow(7, 16, 0)
          },
          {
            code: 'FOUNDER100',
            discount_type: 'flat',
            discount_value: 100,
            max_uses: 50,
            valid_until: daysFromNow(7, 16, 0)
          }
        ]
      },

      // ──────────────────────────────────────────────────────────────────────────
      // Event 4: FREE UI/UX DESIGN WORKSHOP (Male & Female Slots)
      // ──────────────────────────────────────────────────────────────────────────
      {
        commUsername: 'uiux_craft',
        title: 'Design Systems & Micro-Interactions Masterclass',
        description: 'Interactive session building tokens, physics-based springs, and fluid gesture choreography in React Native and Figma. Live component teardowns from Stripe and Airbnb apps.',
        location_name: 'Koramangala 4th Block, Bangalore',
        location_url: 'https://maps.google.com/?q=12.935193,77.624481',
        city: 'Bangalore',
        start_datetime: daysFromNow(6, 11, 0),
        end_datetime: daysFromNow(6, 16, 0),
        ticket_price: 0,
        categories: ['Design & UI/UX', 'Workshops'],
        catSlugs: ['skill-building-workshops'],
        banner_url: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=1200',
        gallery_urls: [
          'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=1200',
          'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200'
        ],
        highlights: [
          { icon_name: 'figma', title: 'Hands-on Figma Lab', description: 'Design variables, modes, and typography tokens' },
          { icon_name: 'code', title: 'Reanimated 3 Demos', description: 'Translating Figma prototypes into 60fps mobile code' },
          { icon_name: 'check-circle', title: 'Certificate of Completion', description: 'Official credential from UI/UX Craft Collective' }
        ],
        things_to_know: [
          { icon_name: 'laptop', label: 'Figma desktop installed on your laptop' },
          { icon_name: 'user-check', label: 'Basic understanding of UI layouts helpful' },
          { icon_name: 'coffee', label: 'Refreshments & high-speed Wi-Fi provided' }
        ],
        ticket_types: [
          {
            name: 'Designer Standard Pass',
            description: 'Free admission for product designers and UI crafters',
            base_price: 0,
            gender_restriction: 'all',
            total_quantity: 60,
            display_order: 0
          },
          {
            name: 'Women in Design Community Pass',
            description: 'Reserved priority seat for female designers and student crafters',
            base_price: 0,
            gender_restriction: 'Female',
            total_quantity: 30,
            display_order: 1
          },
          {
            name: 'Men in Design Community Pass',
            description: 'Reserved seat for male designers and frontend engineers',
            base_price: 0,
            gender_restriction: 'Male',
            total_quantity: 30,
            display_order: 2
          }
        ],
        pricing_rules: [],
        discount_codes: []
      },

      // ──────────────────────────────────────────────────────────────────────────
      // Event 5: PAID OUTDOOR EXPEDITION (Flat ₹300 Discount + Male/Female Passes)
      // ──────────────────────────────────────────────────────────────────────────
      {
        commUsername: 'adventure_ghats',
        title: 'Western Ghats Night Bouldering & Stargazing Camp',
        description: '2-day wilderness expedition to Savandurga monolithic trails. Guided bouldering clinics, sunset bonfire, telescopic stargazing, and riverside hammock camping.',
        location_name: 'Savandurga Base Camp / Western Ghats',
        location_url: 'https://maps.google.com/?q=12.919722,77.293056',
        city: 'Bangalore',
        start_datetime: daysFromNow(9, 6, 0),
        end_datetime: daysFromNow(10, 18, 0),
        ticket_price: 1899,
        categories: ['Outdoors & Travel', 'Fitness & Sports'],
        catSlugs: ['weekend-getaways'],
        banner_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200',
        gallery_urls: [
          'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200',
          'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=1200'
        ],
        highlights: [
          { icon_name: 'compass', title: 'Guided Bouldering Route', description: 'Certified BMC instructors and safety gear' },
          { icon_name: 'moon', title: 'Stargazing Astronomy Session', description: 'High-powered Celestron telescope setup' },
          { icon_name: 'truck', title: 'AC Travel & Tents Included', description: 'Pick up and drop from Koramangala & Indiranagar' }
        ],
        things_to_know: [
          { icon_name: 'shield-alert', label: 'Trekking shoes and warm layer mandatory' },
          { icon_name: 'battery-charging', label: 'Power banks recommended for camp' },
          { icon_name: 'clock', label: 'Bus departs at 6:00 AM on Saturday' }
        ],
        ticket_types: [
          {
            name: 'Solo Trekker (Men)',
            description: 'Male tent sharing, travel, meals, and bouldering gear',
            base_price: 1899,
            gender_restriction: 'Male',
            total_quantity: 30,
            display_order: 0
          },
          {
            name: 'Solo Trekker (Women)',
            description: 'Female tent sharing with female marshals, travel, and gear',
            base_price: 1899,
            gender_restriction: 'Female',
            total_quantity: 30,
            display_order: 1
          },
          {
            name: 'Adventure Duo Pass',
            description: 'Private 2-person alpine tent for pairs (All Genders)',
            base_price: 3299,
            gender_restriction: 'all',
            total_quantity: 20,
            display_order: 2
          }
        ],
        pricing_rules: [
          {
            name: 'Early Explorer ₹300 Off',
            rule_type: 'early_bird_time',
            discount_type: 'flat',
            discount_value: 300,
            valid_until: daysFromNow(5, 23, 59),
            priority: 1
          }
        ],
        discount_codes: [
          {
            code: 'TREK2026',
            discount_type: 'flat',
            discount_value: 250,
            max_uses: 40,
            valid_until: daysFromNow(9, 6, 0)
          }
        ]
      },

      // ──────────────────────────────────────────────────────────────────────────
      // Event 6: PAID ARTISAN COFFEE & SOURDOUGH (15% Discount + Gender Passes)
      // ──────────────────────────────────────────────────────────────────────────
      {
        commUsername: 'culinary_blr',
        title: 'Artisan Sourdough & Coffee Cupping Masterclass',
        description: 'Learn the craft of wild fermentation sourdough baking from scratch alongside an espresso sensory cupping workshop tasting 5 single-origin Indian Arabica coffees.',
        location_name: 'Indiranagar 100ft Road, Bangalore',
        location_url: 'https://maps.google.com/?q=12.978369,77.640837',
        city: 'Bangalore',
        start_datetime: daysFromNow(8, 10, 30),
        end_datetime: daysFromNow(8, 14, 30),
        ticket_price: 650,
        categories: ['Food & Culinary', 'Lifestyle'],
        catSlugs: ['skill-building-workshops'],
        banner_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200',
        gallery_urls: [
          'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=1200',
          'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200'
        ],
        highlights: [
          { icon_name: 'coffee', title: 'Single-Origin Coffee Cupping', description: 'Coorg, Chikmagalur & Araku Valley specialty lots' },
          { icon_name: 'heart', title: 'Take Home Starter Kit', description: '50-year-old active sourdough mother starter jar' },
          { icon_name: 'smile', title: 'Artisanal Brunch Table', description: 'Fresh sourdough tartines, butter, and kombucha' }
        ],
        things_to_know: [
          { icon_name: 'scissors', label: 'Aprons and baking kits provided' },
          { icon_name: 'package', label: 'Bring a container to take baked loaf home' },
          { icon_name: 'check', label: 'No prior baking experience necessary' }
        ],
        ticket_types: [
          {
            name: 'Foodie General Pass',
            description: 'Standard masterclass seat with coffee flight & bread kit',
            base_price: 650,
            gender_restriction: 'all',
            total_quantity: 40,
            display_order: 0
          },
          {
            name: 'Ladies Brunch Special',
            description: 'Special discounted ticket for female food & culinary lovers',
            base_price: 550,
            gender_restriction: 'Female',
            total_quantity: 25,
            display_order: 1
          },
          {
            name: 'Gentlemen Barista Special',
            description: 'Special ticket for male coffee brewing enthusiasts',
            base_price: 550,
            gender_restriction: 'Male',
            total_quantity: 25,
            display_order: 2
          }
        ],
        pricing_rules: [
          {
            name: 'Early Foodie 15% Off',
            rule_type: 'early_bird_time',
            discount_type: 'percentage',
            discount_value: 15,
            valid_until: daysFromNow(5, 23, 59),
            priority: 1
          }
        ],
        discount_codes: [
          {
            code: 'COFFEE15',
            discount_type: 'percentage',
            discount_value: 15,
            max_uses: 50,
            valid_until: daysFromNow(8, 10, 0)
          }
        ]
      },

      // ──────────────────────────────────────────────────────────────────────────
      // Event 7: ESPORTS & GAMING LAN CUP (Free Spectator + Paid Male/Female Slots)
      // ──────────────────────────────────────────────────────────────────────────
      {
        commUsername: 'boardgame_esports_blr',
        title: 'Valorant & Tekken 8 Bangalore LAN Championship',
        description: 'High-octane competitive LAN tournament with 240Hz esports displays, shoutcasting stage, and retro arcade free-play zone. ₹75,000 cash pool on the line.',
        location_name: 'SnooSpace Esports Arena, HSR Layout, Bangalore',
        location_url: 'https://maps.google.com/?q=12.911622,77.638862',
        city: 'Bangalore',
        start_datetime: daysFromNow(11, 12, 0),
        end_datetime: daysFromNow(11, 22, 0),
        ticket_price: 0,
        categories: ['Gaming & Esports', 'Community'],
        catSlugs: ['gaming'],
        banner_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200',
        gallery_urls: [
          'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200',
          'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200'
        ],
        highlights: [
          { icon_name: 'trophy', title: '₹75,000 Cash Prize Pool', description: '₹50K for Valorant 5v5, ₹25K for Tekken 8' },
          { icon_name: 'monitor', title: 'Tournament-grade Rigs', description: 'RTX 4080 rigs + ZOWIE 240Hz gaming monitors' },
          { icon_name: 'tv', title: 'Live English & Hindi Cast', description: 'Streamed live with spectator stadium seating' }
        ],
        things_to_know: [
          { icon_name: 'headphones', label: 'Bring your own peripheral headsets/mice' },
          { icon_name: 'clock', label: 'Player check-in begins at 11:30 AM' },
          { icon_name: 'check', label: 'Free arcade zone open all day for all pass holders' }
        ],
        ticket_types: [
          {
            name: 'Spectator Free Pass',
            description: 'Free stadium entry, arcade zone, and finals watch party',
            base_price: 0,
            gender_restriction: 'all',
            total_quantity: 150,
            display_order: 0
          },
          {
            name: 'Female Esports Challenger Pass',
            description: 'Tournament slot for women gamers in solo / 1v1 divisions',
            base_price: 250,
            gender_restriction: 'Female',
            total_quantity: 30,
            display_order: 1
          },
          {
            name: 'Male Esports Challenger Pass',
            description: 'Tournament slot for male competitors in solo bracket',
            base_price: 250,
            gender_restriction: 'Male',
            total_quantity: 50,
            display_order: 2
          },
          {
            name: 'Pro VIP + Official Jersey',
            description: 'Front-row VIP lounge, free energy drinks & custom gamer jersey',
            base_price: 799,
            gender_restriction: 'all',
            total_quantity: 25,
            display_order: 3
          }
        ],
        pricing_rules: [
          {
            name: 'Early Gamer ₹50 Off',
            rule_type: 'early_bird_time',
            discount_type: 'flat',
            discount_value: 50,
            valid_until: daysFromNow(7, 23, 59),
            priority: 1
          }
        ],
        discount_codes: [
          {
            code: 'GAMER50',
            discount_type: 'flat',
            discount_value: 50,
            max_uses: 60,
            valid_until: daysFromNow(11, 12, 0)
          }
        ]
      },

      // ──────────────────────────────────────────────────────────────────────────
      // Event 8: PAID SUNRISE SOUND BATH & VINYASA (Gender Healing Circles)
      // ──────────────────────────────────────────────────────────────────────────
      {
        commUsername: 'urban_fit_blr',
        title: 'Sunrise Sound Bath & Mindfulness Rooftop Session',
        description: 'Immerse in Tibetan singing bowl sound vibrations, pranayama breathwork, and gentle dynamic vinyasa flow on an open-air turf rooftop overlooking Cubbon Park.',
        location_name: 'Rooftop Sky Garden, MG Road, Bangalore',
        location_url: 'https://maps.google.com/?q=12.975618,77.606628',
        city: 'Bangalore',
        start_datetime: daysFromNow(12, 6, 30),
        end_datetime: daysFromNow(12, 9, 0),
        ticket_price: 350,
        categories: ['Fitness & Sports', 'Wellness'],
        catSlugs: ['wellness-mindfulness'],
        banner_url: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=1200',
        gallery_urls: [
          'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=1200',
          'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200'
        ],
        highlights: [
          { icon_name: 'sun', title: 'Golden Hour Sound Healing', description: '45 minutes of vibrational acoustic resonance' },
          { icon_name: 'heart', title: 'Guided Pranayama', description: 'Stress-relief and nervous system regulation practice' },
          { icon_name: 'coffee', title: 'Herbal Infusions & Smoothies', description: 'Organic cold-pressed juice bar after practice' }
        ],
        things_to_know: [
          { icon_name: 'check', label: 'Eco-friendly cork yoga mats provided' },
          { icon_name: 'shirt', label: 'Wear comfortable stretchable clothing' },
          { icon_name: 'clock', label: 'Please arrive 10 minutes prior to session' }
        ],
        ticket_types: [
          {
            name: "Women's Healing Circle",
            description: 'Dedicated inner circle seating for female practitioners',
            base_price: 350,
            gender_restriction: 'Female',
            total_quantity: 35,
            display_order: 0
          },
          {
            name: "Men's Mindfulness Circle",
            description: 'Dedicated inner circle seating for male practitioners',
            base_price: 350,
            gender_restriction: 'Male',
            total_quantity: 35,
            display_order: 1
          },
          {
            name: 'General Open Mat Pass',
            description: 'Open turf admission for all participants',
            base_price: 450,
            gender_restriction: 'all',
            total_quantity: 30,
            display_order: 2
          }
        ],
        pricing_rules: [
          {
            name: 'Early Riser 20% Off',
            rule_type: 'early_bird_time',
            discount_type: 'percentage',
            discount_value: 20,
            valid_until: daysFromNow(8, 23, 59),
            priority: 1
          }
        ],
        discount_codes: [
          {
            code: 'ZEN20',
            discount_type: 'percentage',
            discount_value: 20,
            max_uses: 50,
            valid_until: daysFromNow(12, 6, 30)
          }
        ]
      }
    ];

    // 6. Insert all events into database
    console.log(`\nInserting ${newEvents.length} distinct events with complete ticket & discount architecture...`);
    const createdEventSummaries = [];

    for (const ev of newEvents) {
      const commId = commMap.get(ev.commUsername) || commMap.get('snoospace');

      // Insert main event row
      const evIns = await pool.query(`
        INSERT INTO events (
          community_id, creator_id, title, description,
          location_name, location_url, city,
          event_date, start_datetime, end_datetime,
          is_published, is_cancelled, access_type, invite_public_visibility,
          ticket_price, categories, banner_url, created_at,
          like_count, comment_count, view_count, share_count, event_type
        ) VALUES (
          $1, $1, $2, $3,
          $4, $5, $6,
          $7, $7, $8,
          true, false, 'public', true,
          $9, $10, $11, NOW(),
          0, 0, 0, 0, 'in-person'
        ) RETURNING id, title, start_datetime, ticket_price
      `, [
        commId, ev.title, ev.description,
        ev.location_name, ev.location_url, ev.city,
        ev.start_datetime, ev.end_datetime,
        ev.ticket_price, ev.categories, ev.banner_url
      ]);

      const eventId = evIns.rows[0].id;

      // Insert banners
      const allBanners = [ev.banner_url, ...(ev.gallery_urls || [])];
      for (let bIdx = 0; bIdx < allBanners.length; bIdx++) {
        await pool.query(`
          INSERT INTO event_banners (event_id, image_url, image_order, created_at)
          VALUES ($1, $2, $3, NOW())
        `, [eventId, allBanners[bIdx], bIdx]);
      }

      // Link discover categories
      for (const slug of ev.catSlugs) {
        const catId = catMap.get(slug);
        if (catId) {
          await pool.query(`
            INSERT INTO event_discover_categories (event_id, category_id, is_featured, display_order, created_at)
            VALUES ($1, $2, true, 0, NOW())
            ON CONFLICT DO NOTHING
          `, [eventId, catId]);
        }
      }

      // Insert highlights
      for (let hIdx = 0; hIdx < ev.highlights.length; hIdx++) {
        const h = ev.highlights[hIdx];
        await pool.query(`
          INSERT INTO event_highlights (event_id, icon_name, title, description, highlight_order, created_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
        `, [eventId, h.icon_name, h.title, h.description, hIdx]);
      }

      // Insert things to know
      for (let tIdx = 0; tIdx < ev.things_to_know.length; tIdx++) {
        const ttk = ev.things_to_know[tIdx];
        await pool.query(`
          INSERT INTO event_things_to_know (event_id, icon_name, label, item_order, created_at)
          VALUES ($1, $2, $3, $4, NOW())
        `, [eventId, ttk.icon_name, ttk.label, tIdx]);
      }

      // Insert ticket types
      const createdTickets = [];
      for (const t of ev.ticket_types) {
        const tIns = await pool.query(`
          INSERT INTO ticket_types (
            event_id, name, description, base_price, total_quantity,
            sold_count, reserved_count, visibility,
            min_per_order, max_per_order, is_active,
            gender_restriction, display_order, created_at
          ) VALUES (
            $1, $2, $3, $4, $5,
            0, 0, 'public',
            1, 5, true,
            $6, $7, NOW()
          ) RETURNING id, name, base_price, gender_restriction
        `, [
          eventId, t.name, t.description, t.base_price, t.total_quantity,
          t.gender_restriction, t.display_order
        ]);
        createdTickets.push(tIns.rows[0]);
      }

      // Insert pricing rules
      const createdRules = [];
      for (const pr of ev.pricing_rules) {
        const prIns = await pool.query(`
          INSERT INTO pricing_rules (
            event_id, ticket_type_id, name, rule_type, discount_type,
            discount_value, valid_until, priority, is_active, applies_to, created_at
          ) VALUES (
            $1, NULL, $2, $3, $4,
            $5, $6, $7, true, 'all', NOW()
          ) RETURNING id, name, discount_type, discount_value
        `, [
          eventId, pr.name, pr.rule_type, pr.discount_type,
          pr.discount_value, pr.valid_until, pr.priority
        ]);
        createdRules.push(prIns.rows[0]);
      }

      // Insert discount codes
      const createdCodes = [];
      for (const dc of ev.discount_codes) {
        const dcIns = await pool.query(`
          INSERT INTO discount_codes (
            event_id, code, code_normalized, discount_type, discount_value,
            max_uses, current_uses, max_uses_per_user, valid_until,
            is_active, applies_to, created_at
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, 0, 1, $7,
            true, 'all', NOW()
          ) RETURNING id, code, discount_type, discount_value
        `, [
          eventId, dc.code, dc.code.toUpperCase().trim(), dc.discount_type,
          dc.discount_value, dc.max_uses, dc.valid_until
        ]);
        createdCodes.push(dcIns.rows[0]);
      }

      // Note: We intentionally do NOT insert any rows into event_registrations!
      // This ensures ZERO registrations exist for these new events.

      createdEventSummaries.push({
        id: eventId,
        title: ev.title,
        price: ev.ticket_price,
        tickets: createdTickets,
        rules: createdRules,
        codes: createdCodes
      });
    }

    console.log('\n================================================================');
    console.log(`✅ Successfully Seeded ${createdEventSummaries.length} New Events with 0 Registrations!`);
    console.log('================================================================\n');

    createdEventSummaries.forEach((s, idx) => {
      console.log(`[Event ${idx + 1}] ID: ${s.id} | "${s.title}" (Base Price: ₹${s.price})`);
      console.log(`  🎟️ Tickets (${s.tickets.length}):`);
      s.tickets.forEach(t => console.log(`     • ${t.name}: ₹${t.base_price} (Gender: ${t.gender_restriction})`));
      if (s.rules.length > 0) {
        console.log(`  🏷️ Pricing Rules (${s.rules.length}):`);
        s.rules.forEach(r => console.log(`     • ${r.name}: ${r.discount_type === 'percentage' ? r.discount_value + '%' : '₹' + r.discount_value} off`));
      }
      if (s.codes.length > 0) {
        console.log(`  🎫 Promo Codes (${s.codes.length}):`);
        s.codes.forEach(c => console.log(`     • Code: ${c.code} (${c.discount_type === 'percentage' ? c.discount_value + '%' : '₹' + c.discount_value} off)`));
      }
      console.log('');
    });

  } catch (err) {
    console.error('Error seeding new events:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedNewUnregisteredEvents();
