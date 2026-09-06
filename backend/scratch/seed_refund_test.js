require("dotenv").config();
const { createPool } = require("./config/db");
const pool = createPool();

async function seed() {
  const comm = await pool.query("SELECT id FROM communities LIMIT 1");
  if (!comm.rows.length) { console.error("No communities"); process.exit(1); }
  const communityId = comm.rows[0].id;

  const mem = await pool.query("SELECT id FROM members LIMIT 1");
  if (!mem.rows.length) { console.error("No members"); process.exit(1); }
  const memberId = mem.rows[0].id;

  await pool.query("INSERT INTO events (id, community_id, creator_id, title, event_date, start_datetime, end_datetime, is_published) VALUES (9901, $1, $1, 'Test Refund Event', NOW()+INTERVAL '7 days', NOW()+INTERVAL '7 days', NOW()+INTERVAL '9 days', true) ON CONFLICT (id) DO NOTHING", [communityId]);
  await pool.query("INSERT INTO ticket_types (id, event_id, name, base_price, total_quantity, sold_count) VALUES (9901, 9901, 'General', 200, 10, 1) ON CONFLICT (id) DO NOTHING");
  await pool.query("INSERT INTO event_registrations (id, event_id, member_id, registration_status, total_amount, qr_code_hash) VALUES (9901, 9901, $1, 'registered', 200.00, 'TESTQRHASH9901') ON CONFLICT (id) DO UPDATE SET registration_status='registered', refund_amount=NULL, cancelled_at=NULL", [memberId]);
  await pool.query("INSERT INTO registration_tickets (id, registration_id, ticket_type_id, ticket_name, quantity, unit_price, total_price) VALUES (9901, 9901, 9901, 'General', 1, 200.00, 200.00) ON CONFLICT (id) DO NOTHING");
  await pool.query("INSERT INTO razorpay_orders (id, razorpay_order_id, user_id, event_id, amount_paise, status) VALUES (9901, 'ord_test_refund_9901', $1, 9901, 20000, 'paid') ON CONFLICT (id) DO UPDATE SET status='paid'", [memberId]);
  await pool.query("INSERT INTO razorpay_payments (id, razorpay_payment_id, razorpay_order_id, user_id, event_id, amount_paise, status, webhook_verified, captured_at) VALUES (9901, 'pay_test_refund_9901', 'ord_test_refund_9901', $1, 9901, 20000, 'captured', true, NOW()) ON CONFLICT (id) DO UPDATE SET status='captured', webhook_verified=true", [memberId]);

  console.log("Seed OK — memberId:", memberId);
  await pool.end();
}
seed().catch(e => { console.error(e.message); process.exit(1); });
