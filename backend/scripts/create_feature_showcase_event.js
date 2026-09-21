require('dotenv').config();
const { createPool } = require('../config/db');

async function main() {
  const pool = createPool();
  try {
    console.log('🚀 Creating Comprehensive Hybrid & Tier-Switching Showcase Event...');

    // 1. Get or pick community (e.g. 54 SnooSpace)
    const commRes = await pool.query("SELECT id FROM communities WHERE id = 54");
    const communityId = commRes.rows[0]?.id || 103;

    // 2. Set event dates (starting tomorrow, 2 days long)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 2);
    startDate.setHours(18, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setHours(22, 0, 0, 0);

    // 3. Insert Hybrid Event
    const eventInsert = await pool.query(
      `INSERT INTO events (
        community_id,
        title,
        description,
        event_date,
        start_datetime,
        end_datetime,
        event_type,
        location_name,
        location_url,
        venue_name,
        address_line1,
        city,
        state,
        meeting_platform,
        meeting_link,
        virtual_link,
        access_type,
        is_published,
        is_paid,
        allow_tier_switching,
        allow_downgrade_refunds,
        allow_queries,
        banner_url,
        category,
        category_group
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
      RETURNING id, title`,
      [
        communityId,
        'SnooSpace Hybrid Tech Summit 2026',
        'The premier hybrid developer conference featuring in-person keynotes in Bengaluru and worldwide interactive live streams. Test ticket access modes (In-Person vs Virtual vs All-Access) and real-time tier switching.',
        startDate,
        startDate,
        endDate,
        'hybrid',
        'Bangalore International Tech Park, Whitefield',
        'https://maps.google.com/?q=ITPB+Whitefield+Bengaluru',
        'Auditorium Alpha, ITPB',
        'ITPL Main Rd, Pattandur Agrahara',
        'Bengaluru',
        'Karnataka',
        'zoom',
        'https://zoom.us/j/99988877766?pwd=hybridtestpass',
        'https://zoom.us/j/99988877766?pwd=hybridtestpass',
        'public',
        true,
        true,
        true,
        false, // downgrade refund false
        true,
        'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop',
        'Technology',
        'professional'
      ]
    );

    const eventId = eventInsert.rows[0].id;
    console.log(`✅ Event created: ID ${eventId} ("${eventInsert.rows[0].title}")`);

    // 4. Create Ticket Tiers
    const tiers = [
      {
        name: 'Virtual Stream Pass',
        desc: 'Live HD interactive stream access, digital Q&A chat, and session recordings.',
        price: 299,
        qty: 100,
        access_mode: 'virtual',
        gender: 'all',
      },
      {
        name: 'In-Person Standard Pass',
        desc: 'Physical admission to ITPB Auditorium, networking lunch, and event swag kit.',
        price: 499,
        qty: 100,
        access_mode: 'in_person',
        gender: 'all',
      },
      {
        name: 'All-Access Hybrid VIP',
        desc: 'Front-row physical seating, VIP speaker lounge access PLUS recorded live stream links.',
        price: 999,
        qty: 50,
        access_mode: 'both',
        gender: 'all',
      },
      {
        name: 'Women in Tech Pass',
        desc: 'Subsidized community ticket for women developers attending in-person.',
        price: 199,
        qty: 50,
        access_mode: 'in_person',
        gender: 'female',
      },
      {
        name: 'Men in Tech Pass',
        desc: 'Subsidized community ticket for male developers attending in-person.',
        price: 199,
        qty: 50,
        access_mode: 'in_person',
        gender: 'male',
      },
    ];

    const tierMap = {};
    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i];
      const res = await pool.query(
        `INSERT INTO ticket_types (
          event_id,
          name,
          description,
          base_price,
          total_quantity,
          sold_count,
          reserved_count,
          min_per_order,
          max_per_order,
          max_per_user,
          gender_restriction,
          access_mode,
          display_order,
          is_active
        ) VALUES ($1, $2, $3, $4, $5, 0, 0, 1, 5, 5, $6, $7, $8, true)
        RETURNING id, name, base_price, gender_restriction, access_mode`,
        [eventId, t.name, t.desc, t.price, t.qty, t.gender, t.access_mode, i + 1]
      );
      tierMap[t.name] = res.rows[0];
      console.log(`   🎟️ Created tier: ${t.name} (ID: ${res.rows[0].id}, ₹${t.price}, Access: ${t.access_mode}, Gender: ${t.gender})`);
    }

    // 5. Configure Host Tier Switching Rules
    const rules = [
      {
        from_tier_id: tierMap['Virtual Stream Pass'].id,
        from_tier_name: 'Virtual Stream Pass',
        allowed_destination_tier_ids: [
          tierMap['In-Person Standard Pass'].id,
          tierMap['All-Access Hybrid VIP'].id,
        ],
      },
      {
        from_tier_id: tierMap['In-Person Standard Pass'].id,
        from_tier_name: 'In-Person Standard Pass',
        allowed_destination_tier_ids: [
          tierMap['Virtual Stream Pass'].id,
          tierMap['All-Access Hybrid VIP'].id,
        ],
      },
      {
        from_tier_id: tierMap['All-Access Hybrid VIP'].id,
        from_tier_name: 'All-Access Hybrid VIP',
        allowed_destination_tier_ids: [
          tierMap['Virtual Stream Pass'].id,
          tierMap['In-Person Standard Pass'].id,
        ],
      },
      {
        from_tier_id: tierMap['Women in Tech Pass'].id,
        from_tier_name: 'Women in Tech Pass',
        allowed_destination_tier_ids: [
          tierMap['In-Person Standard Pass'].id,
          tierMap['All-Access Hybrid VIP'].id,
        ],
      },
      {
        from_tier_id: tierMap['Men in Tech Pass'].id,
        from_tier_name: 'Men in Tech Pass',
        allowed_destination_tier_ids: [
          tierMap['In-Person Standard Pass'].id,
          tierMap['All-Access Hybrid VIP'].id,
        ],
      },
    ];

    await pool.query(
      `UPDATE events SET tier_switch_rules = $1 WHERE id = $2`,
      [JSON.stringify(rules), eventId]
    );
    console.log(`✅ Tier switch rules successfully updated on event.`);

    // 6. Give member 155 ("Veena", female) an active registration for "Virtual Stream Pass"
    const regRes = await pool.query(
      `INSERT INTO event_registrations (
        event_id,
        member_id,
        registration_status,
        status,
        total_amount,
        qr_code_hash
      ) VALUES ($1, $2, 'confirmed', 'confirmed', $3, $4)
      RETURNING id`,
      [eventId, 155, tierMap['Virtual Stream Pass'].base_price, `TEST_QR_${eventId}_155_${Date.now()}`]
    );
    const regId = regRes.rows[0].id;

    await pool.query(
      `INSERT INTO registration_tickets (
        registration_id,
        ticket_type_id,
        ticket_name,
        quantity,
        unit_price,
        total_price
      ) VALUES ($1, $2, $3, 1, $4, $4)`,
      [
        regId,
        tierMap['Virtual Stream Pass'].id,
        tierMap['Virtual Stream Pass'].name,
        tierMap['Virtual Stream Pass'].base_price
      ]
    );

    await pool.query(
      `UPDATE ticket_types SET sold_count = sold_count + 1 WHERE id = $1`,
      [tierMap['Virtual Stream Pass'].id]
    );

    console.log(`🎉 Registration created for Veena (member 155): Registration ID ${regId}`);
    console.log(`   Initial Ticket: "Virtual Stream Pass" (ID: ${tierMap['Virtual Stream Pass'].id})`);
    console.log(`   Veena can now open the app -> My Tickets -> Tap Switch Tier!`);

  } catch (err) {
    console.error('❌ Error creating showcase event:', err);
  } finally {
    await pool.end();
  }
}

main();
