const { createPool } = require('../config/db');
const pool = createPool();

async function run() {
  try {
    const userId = 1;

    // Feature event 52 as a test
    await pool.query("UPDATE events SET is_featured = true, featured_until = NOW() + INTERVAL '7 days' WHERE id = 52");

    // Test combined query logic
    const scoreSql = '0';
    const featuredQuery = `
      SELECT 
        e.id as "eventId", 
        e.title, 
        e.banner_url as "coverUrl",
        e.start_datetime as "startDatetime",
        e.event_type as "eventType",
        true as "isFeatured",
        COALESCE((
          SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id AND er.registration_status = 'registered'
        ), 0)::int as "attendeeCount",
        EXISTS (SELECT 1 FROM event_interests ei WHERE ei.event_id = e.id AND ei.member_id = $1) as "isInterested",
        CASE WHEN e.max_attendees IS NOT NULL THEN GREATEST(0, e.max_attendees - COALESCE((SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id AND er.registration_status = 'registered'), 0)::int) ELSE NULL END as "spotsLeft",
        CASE WHEN e.start_datetime <= NOW() AND (e.end_datetime >= NOW() OR e.end_datetime IS NULL) AND e.start_datetime >= NOW() - INTERVAL '4 hours' THEN true ELSE false END as "isLiveNow",
        CASE WHEN e.is_paid = false OR e.ticket_price = 0 OR e.ticket_price IS NULL THEN true ELSE false END as "isFree",
        ${scoreSql} as score
      FROM events e
      WHERE e.is_featured = true
        AND (e.featured_until IS NULL OR e.featured_until > NOW())
        AND e.start_datetime > NOW()
        AND (e.is_published = true OR e.is_published IS NULL)
        AND e.is_cancelled IS NOT TRUE
      ORDER BY e.featured_until ASC NULLS LAST, e.start_datetime ASC
      LIMIT 10
    `;
    const featuredRes = await pool.query(featuredQuery, [userId]);
    const featuredEvents = featuredRes.rows.map(r => ({
      ...r,
      spotsLeft: r.spotsLeft !== null ? Number(r.spotsLeft) : null,
      score: Number(r.score) || 0
    }));

    const featuredIds = featuredEvents.map(e => e.eventId);
    const remainingSlots = Math.max(0, 10 - featuredEvents.length);

    let velocityEvents = [];
    if (remainingSlots > 0) {
      const velocityQuery = `
        SELECT 
          e.id as "eventId", 
          e.title, 
          e.banner_url as "coverUrl",
          e.start_datetime as "startDatetime",
          e.event_type as "eventType",
          false as "isFeatured",
          COALESCE((
            SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id AND er.registration_status = 'registered'
          ), 0)::int as "attendeeCount",
          EXISTS (SELECT 1 FROM event_interests ei WHERE ei.event_id = e.id AND ei.member_id = $1) as "isInterested",
          CASE WHEN e.max_attendees IS NOT NULL THEN GREATEST(0, e.max_attendees - COALESCE((SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id AND er.registration_status = 'registered'), 0)::int) ELSE NULL END as "spotsLeft",
          CASE WHEN e.start_datetime <= NOW() AND (e.end_datetime >= NOW() OR e.end_datetime IS NULL) AND e.start_datetime >= NOW() - INTERVAL '4 hours' THEN true ELSE false END as "isLiveNow",
          CASE WHEN e.is_paid = false OR e.ticket_price = 0 OR e.ticket_price IS NULL THEN true ELSE false END as "isFree",
          (
            COALESCE((
              SELECT COUNT(*)::int * 3
              FROM event_registrations er
              WHERE er.event_id = e.id 
                AND er.created_at >= NOW() - INTERVAL '48 hours'
                AND er.registration_status IN ('registered', 'attended', 'confirmed')
            ), 0) +
            COALESCE((
              SELECT COUNT(*)::int * 1
              FROM event_interests ei
              WHERE ei.event_id = e.id 
                AND ei.created_at >= NOW() - INTERVAL '48 hours'
            ), 0)
          ) as "velocityScore",
          ${scoreSql} as score
        FROM events e
        WHERE e.start_datetime > NOW()
          AND (e.is_published = true OR e.is_published IS NULL)
          AND e.is_cancelled IS NOT TRUE
          ${featuredIds.length > 0 ? `AND e.id != ALL($2::bigint[])` : ''}
        ORDER BY "velocityScore" DESC, score DESC, e.start_datetime ASC
        LIMIT $${featuredIds.length > 0 ? '3' : '2'}
      `;
      const params = featuredIds.length > 0 ? [userId, featuredIds, remainingSlots] : [userId, remainingSlots];
      const velocityRes = await pool.query(velocityQuery, params);
      velocityEvents = velocityRes.rows.map(r => ({
        ...r,
        spotsLeft: r.spotsLeft !== null ? Number(r.spotsLeft) : null,
        score: Number(r.score) || 0
      }));
    }

    const whatsHot = [...featuredEvents, ...velocityEvents];
    console.log('COMBINED WHATS HOT (Total:', whatsHot.length, '):');
    console.table(whatsHot.map(w => ({
      eventId: w.eventId,
      title: w.title.substring(0, 35),
      isFeatured: w.isFeatured,
      velocityScore: w.velocityScore,
      attendeeCount: w.attendeeCount
    })));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

run();
