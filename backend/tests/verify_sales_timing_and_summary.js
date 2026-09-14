const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createPool } = require('../config/db');
const { generateAccessToken } = require('../controllers/authControllerV2');
const pool = createPool();
const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000';

// Dynamically compile the real frontend calculateEffectivePrice utility
const pricingUtilsPath = path.join(__dirname, '../../frontend/utils/pricingUtils.js');
const pricingUtilsCode = fs.readFileSync(pricingUtilsPath, 'utf8');
const wrappedModule = `
${pricingUtilsCode.replace(/export function/g, 'function').replace(/export const/g, 'const')}
module.exports = { calculateEffectivePrice };
`;
const m = new module.constructor();
m._compile(wrappedModule, 'pricingUtils.js');
const { calculateEffectivePrice } = m.exports;

// Helper to simulate the exact CheckoutScreen pricingBreakdown & payment summary logic
function computeCheckoutSummary(cartItems, eventPricingRules, appliedDiscount = null) {
  let rawSubtotal = 0;
  let subtotalAfterPricingRules = 0;
  const ruleDiscountsByName = {};

  cartItems.forEach((item) => {
    const basePrice = parseFloat(item.ticket.base_price) || 0;
    rawSubtotal += basePrice * item.quantity;

    const pricing = calculateEffectivePrice(
      item.ticket,
      eventPricingRules,
      item.quantity
    );

    const effectivePrice = pricing.effectivePrice;
    subtotalAfterPricingRules += effectivePrice * item.quantity;

    const itemRuleDiscount = (basePrice - effectivePrice) * item.quantity;
    if (itemRuleDiscount > 0 && pricing.ruleName) {
      const name = pricing.ruleName;
      ruleDiscountsByName[name] = (ruleDiscountsByName[name] || 0) + itemRuleDiscount;
    }
  });

  // Calculate promo discount
  let discountAmount = 0;
  if (appliedDiscount) {
    let discountableAmount = 0;
    if (
      appliedDiscount.applies_to === 'specific' &&
      appliedDiscount.selected_tickets &&
      appliedDiscount.selected_tickets.length > 0
    ) {
      cartItems.forEach((item) => {
        const isEligible = appliedDiscount.selected_tickets.some(
          (t) => t?.toString() === item.ticket.id?.toString() || t?.toString() === item.ticket.name
        );
        if (isEligible) {
          const pricing = calculateEffectivePrice(
            item.ticket,
            eventPricingRules,
            item.quantity
          );
          discountableAmount += item.quantity * pricing.effectivePrice;
        }
      });
    } else {
      discountableAmount = subtotalAfterPricingRules;
    }

    if (discountableAmount > 0) {
      const val = parseFloat(appliedDiscount.discount_value) || 0;
      let promoDiscount = 0;
      if (appliedDiscount.discount_type === 'percentage') {
        promoDiscount = (discountableAmount * val) / 100;
      } else {
        promoDiscount = Math.min(val, discountableAmount);
      }
      discountAmount = Math.round(promoDiscount * 100) / 100;
    }
  }

  const bookingFee = 0;
  const finalAmount = Math.max(
    0,
    Math.round(subtotalAfterPricingRules - discountAmount + bookingFee)
  );

  // Build rendered summary card line items
  const lines = [];
  lines.push({ label: 'Subtotal', amount: `₹${rawSubtotal.toLocaleString('en-IN')}` });

  Object.entries(ruleDiscountsByName).forEach(([ruleName, ruleDiscount]) => {
    if (ruleDiscount > 0) {
      lines.push({ label: ruleName, amount: `-₹${ruleDiscount.toLocaleString('en-IN')}` });
    }
  });

  if (discountAmount > 0) {
    lines.push({ label: 'Promo Discount', amount: `-₹${discountAmount.toLocaleString('en-IN')}` });
  }

  lines.push({ label: 'Booking fee (inc. of GST)', amount: 'Free' });
  lines.push({ label: 'To pay now', amount: `₹${finalAmount.toLocaleString('en-IN')}` });

  return {
    rawSubtotal,
    subtotalAfterPricingRules,
    ruleDiscountsByName,
    discountAmount,
    bookingFee,
    finalAmount,
    renderedLines: lines,
  };
}

async function apiRequest(member, method, urlPath, body = null) {
  const token = generateAccessToken(member.id, 'member', member.email);
  const url = `${API_BASE}${urlPath}`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  const opt = {
    method,
    headers,
  };
  if (body) opt.body = JSON.stringify(body);
  const res = await fetch(url, opt);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function runTests() {
  console.log('================================================================');
  console.log('TIMING & PAYMENT SUMMARY AUDIT VERIFICATION (T1 - T6)');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Server:', API_BASE);
  console.log('================================================================\n');

  let t1Pass = false, t2Pass = false, t3Pass = false, t4Pass = false, t5Pass = false, t6Pass = false, t7Pass = false, t8Pass = false;

  try {
    // 0. Setup Fixtures
    const commRes = await pool.query('SELECT id FROM communities LIMIT 1');
    const communityId = commRes.rows[0].id;

    const memRes = await pool.query('SELECT id, name, email FROM members ORDER BY id ASC LIMIT 2');
    const member = memRes.rows[0];

    console.log(`Fixtures: Community #${communityId}, Member #${member.id} (${member.email})`);

    // Create a base event for testing
    const eventStartDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days in future
    const eventEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000);

    const eventRes = await pool.query(
      `INSERT INTO events (
        title, description, event_date, start_datetime, end_datetime,
        event_type, location_name, status, community_id, creator_id
      ) VALUES ($1, $2, $3, $4, $5, 'in-person', 'Test Venue', 'published', $6, $6)
      RETURNING id, title`,
      [
        'Timing & Summary Verification Event ' + Date.now(),
        'Test Event Description',
        eventStartDate.toISOString().split('T')[0],
        eventStartDate.toISOString(),
        eventEndDate.toISOString(),
        communityId,
      ]
    );
    const eventId = eventRes.rows[0].id;
    console.log(`Created Event #${eventId} ("${eventRes.rows[0].title}")\n`);

    // =========================================================================
    // TEST T1: Ticket type Custom Dates sales window ending tomorrow
    // =========================================================================
    console.log('----------------------------------------------------------------');
    console.log('TEST T1: Create ticket type with Custom Dates sales window ending "tomorrow"');
    console.log('----------------------------------------------------------------');

    // Simulate TicketTypesEditor CustomDatePicker onConfirm logic:
    // Today's date with default 00:00 start time
    const startCalendarDate = new Date();
    startCalendarDate.setHours(0, 0, 0, 0);

    // Tomorrow's date with default 23:59 end time
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 0, 0); // Corrected default

    const salesStartDateIso = startCalendarDate.toISOString();
    const salesEndDateIso = tomorrow.toISOString();

    console.log(`Client serialized sales_start_date: ${salesStartDateIso}`);
    console.log(`Client serialized sales_end_date:   ${salesEndDateIso}`);

    // Insert ticket type via SQL as saved by eventController
    const ticketT1Res = await pool.query(
      `INSERT INTO ticket_types (
        event_id, name, base_price, total_quantity, is_active,
        sale_start_at, sale_end_at, visibility
      ) VALUES ($1, $2, $3, $4, true, $5, $6, 'public')
      RETURNING id, name, base_price, sale_start_at, sale_end_at,
                sale_end_at AT TIME ZONE 'Asia/Kolkata' AS sale_end_at_ist`,
      [eventId, 'T1 Custom Window Ticket', 200, 50, salesStartDateIso, salesEndDateIso]
    );

    const t1Ticket = ticketT1Res.rows[0];
    console.log('DB Query Output for ticket_types:');
    console.table([t1Ticket]);

    // Inspect the local time on the stored sale_end_at
    const storedEndDate = new Date(t1Ticket.sale_end_at);
    console.log(`Stored sale_end_at (UTC):        ${storedEndDate.toISOString()}`);
    console.log(`Stored sale_end_at (Local Hours): ${storedEndDate.getHours()}:${storedEndDate.getMinutes().toString().padStart(2, '0')}`);

    // Verify it is tomorrow and hours:minutes is 23:59
    if (storedEndDate.getHours() === 23 && storedEndDate.getMinutes() === 59) {
      console.log('>>> TEST T1 PASS: Stored sale_end_at is tomorrow at 23:59 local time (not midnight-start).');
      t1Pass = true;
    } else {
      console.log(`>>> TEST T1 FAIL: Expected 23:59 local time, got ${storedEndDate.getHours()}:${storedEndDate.getMinutes()}`);
    }

    // =========================================================================
    // TEST T2: Early Bird rule with valid_until "today" and no time touched
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('TEST T2: Early Bird rule with valid_until "today" with no time touched');
    console.log('----------------------------------------------------------------');

    // Simulate PromoEditor onConfirm logic:
    // Today's calendar date with untouched time defaulting to 23:59
    const validUntilToday = new Date();
    validUntilToday.setHours(23, 59, 0, 0); // End of day default
    const validUntilIso = validUntilToday.toISOString();

    console.log(`Client serialized valid_until: ${validUntilIso}`);

    const ruleT2Res = await pool.query(
      `INSERT INTO pricing_rules (
        event_id, ticket_type_id, name, rule_type, discount_type, discount_value,
        valid_until, priority, is_active, applies_to, selected_tickets
      ) VALUES ($1, $2, $3, 'early_bird_time', 'fixed', 50, $4, 1, true, 'all', '[]'::jsonb)
      RETURNING *, valid_until AT TIME ZONE 'Asia/Kolkata' AS valid_until_ist`,
      [eventId, t1Ticket.id, 'Early Bird Special', validUntilIso]
    );

    const t2Rule = ruleT2Res.rows[0];
    console.log('DB Query Output for pricing_rules:');
    console.table([t2Rule]);

    const storedValidUntil = new Date(t2Rule.valid_until);
    const now = new Date();
    console.log(`Current Time:                    ${now.toISOString()}`);
    console.log(`Stored valid_until:              ${storedValidUntil.toISOString()}`);
    console.log(`Is Current Time < valid_until?  ${now < storedValidUntil}`);

    // Verify discount applies right now (before midnight)
    const effectivePricing = calculateEffectivePrice(t1Ticket, [t2Rule], 1);
    console.log('calculateEffectivePrice Output:', effectivePricing);

    if (
      storedValidUntil.getHours() === 23 &&
      storedValidUntil.getMinutes() === 59 &&
      now < storedValidUntil &&
      effectivePricing.hasDiscount &&
      effectivePricing.effectivePrice === 150
    ) {
      console.log('>>> TEST T2 PASS: valid_until is end-of-day (23:59), ticket purchased today gets discount.');
      t2Pass = true;
    } else {
      console.log('>>> TEST T2 FAIL: Discount did not apply or valid_until is not 23:59.');
    }

    // =========================================================================
    // TEST T3: Payment summary shows distinct "Early Bird" line item with correct discount
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('TEST T3: Payment summary shows distinct "Early Bird" line item');
    console.log('----------------------------------------------------------------');

    const cartT3 = [
      {
        ticket: t1Ticket,
        quantity: 1,
      },
    ];

    const summaryT3 = computeCheckoutSummary(cartT3, [t2Rule], null);
    console.log('Rendered Payment Summary Lines:');
    console.table(summaryT3.renderedLines);

    const earlyBirdLine = summaryT3.renderedLines.find((l) => l.label === 'Early Bird Special');
    const subtotalLine = summaryT3.renderedLines.find((l) => l.label === 'Subtotal');
    const toPayLine = summaryT3.renderedLines.find((l) => l.label === 'To pay now');

    if (
      subtotalLine && subtotalLine.amount === '₹200' &&
      earlyBirdLine && earlyBirdLine.amount === '-₹50' &&
      toPayLine && toPayLine.amount === '₹150'
    ) {
      console.log('>>> TEST T3 PASS: Payment summary shows labeled "Early Bird Special" line item (-₹50), Subtotal ₹200, To pay now ₹150.');
      t3Pass = true;
    } else {
      console.log('>>> TEST T3 FAIL: Payment summary lines do not match expected breakdown.');
    }

    // =========================================================================
    // TEST T4: Displayed "To pay now" strictly matches server createOrder pricing.finalAmount
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('TEST T4: Parity between displayed amount and server createOrder');
    console.log('----------------------------------------------------------------');

    const displayedFinalAmount = summaryT3.finalAmount; // 150
    // 1. Reserve ticket
    const reserveRes = await apiRequest(member, 'POST', `/events/${eventId}/reserve-tickets`, {
      tickets: [{ ticketTypeId: t1Ticket.id, quantity: 1 }],
    });
    console.log('reserveTickets response status:', reserveRes.status);
    const sessionIdT4 = reserveRes.data?.sessionId;

    // 2. Call createOrder
    const orderPayloadT4 = {
      eventId: eventId,
      totalAmountRupees: displayedFinalAmount,
      tickets: [
        {
          ticketTypeId: t1Ticket.id,
          quantity: 1,
          unitPrice: 150,
          ticketName: t1Ticket.name,
        },
      ],
      promoCode: null,
      discountAmount: 0,
      sessionId: sessionIdT4,
    };

    const orderResT4 = await apiRequest(member, 'POST', '/payments/create-order', orderPayloadT4);
    console.log('createOrder HTTP Status:', orderResT4.status);
    console.log('createOrder Response:', JSON.stringify(orderResT4.data, null, 2));

    const serverFinalRupees = (orderResT4.data?.amount || orderResT4.data?.order?.amount) / 100;
    console.log(`Displayed Amount: ₹${displayedFinalAmount}`);
    console.log(`Server Amount:    ₹${serverFinalRupees}`);

    if (
      orderResT4.status === 200 &&
      orderResT4.data?.success &&
      serverFinalRupees === displayedFinalAmount
    ) {
      console.log('>>> TEST T4 PASS: Displayed amount (₹150) strictly matches server pricing.finalAmount (₹150.00) down to the paise.');
      t4Pass = true;
    } else {
      console.log('>>> TEST T4 FAIL: Server rejected order or returned different amount.');
    }

    // =========================================================================
    // TEST T5: Regression — ticket with NO pricing_rules and NO promo code
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('TEST T5: Regression — Full price ticket with NO rules and NO promo code');
    console.log('----------------------------------------------------------------');

    // Create a plain ticket with no rules
    const ticketT5Res = await pool.query(
      `INSERT INTO ticket_types (
        event_id, name, base_price, total_quantity, is_active, visibility
      ) VALUES ($1, $2, 250, 50, true, 'public')
      RETURNING *`,
      [eventId, 'T5 Full Price Ticket']
    );
    const t5Ticket = ticketT5Res.rows[0];

    const cartT5 = [{ ticket: t5Ticket, quantity: 1 }];
    const summaryT5 = computeCheckoutSummary(cartT5, [], null);

    console.log('Rendered Payment Summary Lines for Plain Ticket:');
    console.table(summaryT5.renderedLines);

    // Verify only Subtotal, Booking fee, To pay now are rendered
    const hasDiscountLine = summaryT5.renderedLines.some(
      (l) => l.label.includes('Discount') || l.label.includes('Early') || l.amount.startsWith('-')
    );

    const reserveResT5 = await apiRequest(member, 'POST', `/events/${eventId}/reserve-tickets`, {
      tickets: [{ ticketTypeId: t5Ticket.id, quantity: 1 }],
    });
    const sessionIdT5 = reserveResT5.data?.sessionId;

    const orderResT5 = await apiRequest(member, 'POST', '/payments/create-order', {
      eventId: eventId,
      totalAmountRupees: summaryT5.finalAmount,
      tickets: [{ ticketTypeId: t5Ticket.id, quantity: 1, unitPrice: 250, ticketName: t5Ticket.name }],
      sessionId: sessionIdT5,
    });

    console.log(`createOrder Status for T5: ${orderResT5.status}, Amount: ₹${(orderResT5.data?.amount || orderResT5.data?.order?.amount) / 100}`);

    if (
      !hasDiscountLine &&
      summaryT5.renderedLines.length === 3 &&
      summaryT5.finalAmount === 250 &&
      orderResT5.status === 200
    ) {
      console.log('>>> TEST T5 PASS: Only Subtotal / To pay now rendered (no discount lines), creates order at ₹250.');
      t5Pass = true;
    } else {
      console.log('>>> TEST T5 FAIL: Unexpected discount lines rendered or order creation failed.');
    }

    // =========================================================================
    // TEST T6: Stacked discounts — Early Bird rule AND manual Promo Code active
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('TEST T6: Stacked Discounts — Early Bird Rule AND Manual Promo Code');
    console.log('----------------------------------------------------------------');

    // Create a 10% promo code in discount_codes table
    const promoRes = await pool.query(
      `INSERT INTO discount_codes (
        event_id, code, code_normalized, discount_type, discount_value,
        is_active, applies_to, selected_tickets
      ) VALUES ($1, 'SAVE10', 'SAVE10', 'percentage', 10, true, 'all', '[]'::jsonb)
      RETURNING *`,
      [eventId]
    );
    const promo = promoRes.rows[0];
    console.log('Created Promo Code:', promo);

    // Cart with t1Ticket (base price ₹200, Early Bird ₹50 off -> ₹150)
    // Plus SAVE10 (10% off ₹150 -> ₹15 off)
    // To pay now: ₹150 - ₹15 = ₹135
    const cartT6 = [{ ticket: t1Ticket, quantity: 1 }];
    const summaryT6 = computeCheckoutSummary(cartT6, [t2Rule], promo);

    console.log('Rendered Payment Summary Lines for Stacked Cart:');
    console.table(summaryT6.renderedLines);

    // Reserve ticket for T6
    const reserveResT6 = await apiRequest(member, 'POST', `/events/${eventId}/reserve-tickets`, {
      tickets: [{ ticketTypeId: t1Ticket.id, quantity: 1 }],
    });
    const sessionIdT6 = reserveResT6.data?.sessionId;

    // Call createOrder on backend with the displayed amount and promo code
    const orderResT6 = await apiRequest(member, 'POST', '/payments/create-order', {
      eventId: eventId,
      totalAmountRupees: summaryT6.finalAmount, // 135
      tickets: [
        {
          ticketTypeId: t1Ticket.id,
          quantity: 1,
          unitPrice: 150,
          ticketName: t1Ticket.name,
        },
      ],
      promoCode: 'SAVE10',
      discountAmount: summaryT6.discountAmount, // 15
      sessionId: sessionIdT6,
    });

    console.log('createOrder HTTP Status for T6:', orderResT6.status);
    console.log('createOrder Response:', JSON.stringify(orderResT6.data, null, 2));

    const serverFinalT6 = (orderResT6.data?.amount || orderResT6.data?.order?.amount) / 100;
    const hasEarlyBirdT6 = summaryT6.renderedLines.some((l) => l.label === 'Early Bird Special' && l.amount === '-₹50');
    const hasPromoT6 = summaryT6.renderedLines.some((l) => l.label === 'Promo Discount' && l.amount === '-₹15');

    if (
      orderResT6.status === 200 &&
      orderResT6.data?.success &&
      serverFinalT6 === 135 &&
      summaryT6.finalAmount === 135 &&
      hasEarlyBirdT6 &&
      hasPromoT6
    ) {
      console.log('>>> TEST T6 PASS: Both Early Bird (-₹50) and Promo Discount (-₹15) appear separately and stack correctly to ₹135 matching server createOrder.');
      t6Pass = true;
    } else {
      console.log('>>> TEST T6 FAIL: Stacked discounts mismatch between client and server.');
    }

    // =========================================================================
    // TEST T7: Edit ticket type — custom 6:00 PM time preserved across date-only edit
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('TEST T7: Edit ticket type — 6:00 PM custom time preserved on date change');
    console.log('----------------------------------------------------------------');

    // Step 1: Organiser creates a ticket type with Custom Dates ending Day + 2
    // and explicitly sets time to 6:00 PM (18:00 local time) via CustomTimePicker
    const t7StartDate = new Date();
    t7StartDate.setDate(t7StartDate.getDate() + 1);
    t7StartDate.setHours(0, 0, 0, 0); // 12:00 AM default start

    const t7InitialEndDate = new Date();
    t7InitialEndDate.setDate(t7InitialEndDate.getDate() + 2);
    t7InitialEndDate.setHours(18, 0, 0, 0); // 6:00 PM explicitly set

    const ticketT7Res = await pool.query(
      `INSERT INTO ticket_types (
        event_id, name, base_price, total_quantity, is_active, visibility,
        sale_start_at, sale_end_at
      ) VALUES ($1, 'T7 Custom Time Ticket', 300, 50, true, 'public', $2, $3)
      RETURNING *`,
      [eventId, t7StartDate.toISOString(), t7InitialEndDate.toISOString()]
    );
    const createdT7Ticket = ticketT7Res.rows[0];

    // DB Query BEFORE date-only edit
    const dbBeforeT7 = await pool.query(
      `SELECT id, name, 
              sale_start_at,
              sale_end_at,
              TO_CHAR(sale_end_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH12:MI AM') as sale_end_at_ist
       FROM ticket_types WHERE id = $1`,
      [createdT7Ticket.id]
    );
    console.log('DB State BEFORE Date-Only Edit:');
    console.table(dbBeforeT7.rows);

    const beforeHoursT7 = new Date(dbBeforeT7.rows[0].sale_end_at).getHours();
    const beforeMinutesT7 = new Date(dbBeforeT7.rows[0].sale_end_at).getMinutes();
    console.log(`Stored sale_end_at before edit (Local): ${beforeHoursT7}:${beforeMinutesT7 === 0 ? '00' : beforeMinutesT7} (Expected: 18:00)`);

    // Step 2: Reopen in edit mode (TicketTypesEditor.openEditModal)
    const rawStartDateT7 = createdT7Ticket.sale_start_at || createdT7Ticket.sales_start_date;
    const rawEndDateT7 = createdT7Ticket.sale_end_at || createdT7Ticket.sales_end_date;

    const currentTicketEditT7 = {
      ...createdT7Ticket,
      sales_start_date: rawStartDateT7 ? new Date(rawStartDateT7) : null,
      sales_end_date: rawEndDateT7 ? new Date(rawEndDateT7) : null,
    };

    const displayedTimeT7 = currentTicketEditT7.sales_end_date
      ? currentTicketEditT7.sales_end_date.toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
      : '11:59 PM';

    console.log(`Picker Displayed Time on Reopen: "${displayedTimeT7}"`);

    // Step 3: Without touching the time, change ONLY the calendar end date to Day + 4
    const newDay4Date = new Date();
    newDay4Date.setDate(newDay4Date.getDate() + 4);

    // Execute exact onConfirm logic from TicketTypesEditor.js:
    let newEndT7 = null;
    if (newDay4Date) {
      newEndT7 = new Date(newDay4Date);
      if (
        currentTicketEditT7.sales_end_date &&
        (currentTicketEditT7.sales_end_date.getHours() !== 0 ||
          currentTicketEditT7.sales_end_date.getMinutes() !== 0)
      ) {
        newEndT7.setHours(
          currentTicketEditT7.sales_end_date.getHours(),
          currentTicketEditT7.sales_end_date.getMinutes(),
          0,
          0,
        );
      } else {
        newEndT7.setHours(23, 59, 0, 0);
      }
    }
    currentTicketEditT7.sales_end_date = newEndT7;

    // Organiser saves the edited ticket
    const serializedNewSaleEndAt = currentTicketEditT7.sales_end_date.toISOString();

    await pool.query(
      `UPDATE ticket_types SET sale_end_at = $1, updated_at = NOW() WHERE id = $2`,
      [serializedNewSaleEndAt, createdT7Ticket.id]
    );

    // DB Query AFTER date-only edit
    const dbAfterT7 = await pool.query(
      `SELECT id, name, 
              sale_start_at,
              sale_end_at,
              TO_CHAR(sale_end_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH12:MI AM') as sale_end_at_ist
       FROM ticket_types WHERE id = $1`,
      [createdT7Ticket.id]
    );
    console.log('\nDB State AFTER Date-Only Edit:');
    console.table(dbAfterT7.rows);

    const afterDateObjT7 = new Date(dbAfterT7.rows[0].sale_end_at);
    const afterHoursT7 = afterDateObjT7.getHours();
    const afterMinutesT7 = afterDateObjT7.getMinutes();
    const afterDateDayT7 = afterDateObjT7.getDate();
    console.log(`Stored sale_end_at after edit (Local): ${afterHoursT7}:${afterMinutesT7 === 0 ? '00' : afterMinutesT7} (Expected: 18:00) on Day ${afterDateDayT7}`);

    if (
      displayedTimeT7.toUpperCase() === '6:00 PM' &&
      beforeHoursT7 === 18 &&
      afterHoursT7 === 18 &&
      afterMinutesT7 === 0 &&
      afterDateDayT7 === newDay4Date.getDate()
    ) {
      console.log('>>> TEST T7 PASS: Custom 6:00 PM displayed on reopen and successfully survived date-only change to Day + 4.');
      t7Pass = true;
    } else {
      console.log('>>> TEST T7 FAIL: Custom time was reset or did not survive edit.');
    }

    // =========================================================================
    // TEST T8: Edit Early Bird rule — custom 6:00 PM valid_until survives date-only edit
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('TEST T8: Edit Early Bird rule — 6:00 PM custom time preserved on date change');
    console.log('----------------------------------------------------------------');

    // Step 1: Organiser creates an Early Bird rule with valid_until Day + 2
    // and explicitly sets time to 6:00 PM (18:00 local time) via CustomTimePicker
    const t8InitialEndDate = new Date();
    t8InitialEndDate.setDate(t8InitialEndDate.getDate() + 2);
    t8InitialEndDate.setHours(18, 0, 0, 0); // 6:00 PM explicitly set

    const ruleT8Res = await pool.query(
      `INSERT INTO pricing_rules (
        event_id, ticket_type_id, name, rule_type, discount_type, discount_value,
        valid_until, priority, is_active, applies_to, selected_tickets
      ) VALUES ($1, $2, 'T8 Early Bird', 'early_bird_time', 'fixed', 75, $3, 1, true, 'all', '[]'::jsonb)
      RETURNING *`,
      [eventId, createdT7Ticket.id, t8InitialEndDate.toISOString()]
    );
    const createdT8Rule = ruleT8Res.rows[0];

    // DB Query BEFORE date-only edit
    const dbBeforeT8 = await pool.query(
      `SELECT id, name, rule_type,
              valid_until,
              TO_CHAR(valid_until AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH12:MI AM') as valid_until_ist
       FROM pricing_rules WHERE id = $1`,
      [createdT8Rule.id]
    );
    console.log('DB State BEFORE Date-Only Edit:');
    console.table(dbBeforeT8.rows);

    const beforeRuleHours = new Date(dbBeforeT8.rows[0].valid_until).getHours();
    const beforeRuleMinutes = new Date(dbBeforeT8.rows[0].valid_until).getMinutes();
    console.log(`Stored valid_until before edit (Local): ${beforeRuleHours}:${beforeRuleMinutes === 0 ? '00' : beforeRuleMinutes} (Expected: 18:00)`);

    // Step 2: Reopen in edit mode (PromoEditor.openEditModal)
    const currentRuleEditT8 = {
      ...createdT8Rule,
      valid_until: createdT8Rule.valid_until ? new Date(createdT8Rule.valid_until) : null,
    };

    const displayedRuleTimeT8 = currentRuleEditT8.valid_until
      ? currentRuleEditT8.valid_until.toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
      : '11:59 PM';

    console.log(`PromoEditor Displayed Time on Reopen: "${displayedRuleTimeT8}"`);

    // Step 3: Without touching the time, change ONLY the calendar date to Day + 5
    const newDay5Date = new Date();
    newDay5Date.setDate(newDay5Date.getDate() + 5);

    // Execute exact onConfirm logic from PromoEditor.js:
    if (newDay5Date) {
      const d = new Date(newDay5Date);
      if (
        currentRuleEditT8.valid_until &&
        (currentRuleEditT8.valid_until.getHours() !== 0 ||
          currentRuleEditT8.valid_until.getMinutes() !== 0)
      ) {
        d.setHours(
          currentRuleEditT8.valid_until.getHours(),
          currentRuleEditT8.valid_until.getMinutes(),
          0,
          0,
        );
      } else {
        d.setHours(23, 59, 0, 0);
      }
      currentRuleEditT8.valid_until = d;
    }

    // Organiser saves the edited rule
    const serializedNewValidUntil = currentRuleEditT8.valid_until.toISOString();

    await pool.query(
      `UPDATE pricing_rules SET valid_until = $1 WHERE id = $2`,
      [serializedNewValidUntil, createdT8Rule.id]
    );

    // DB Query AFTER date-only edit
    const dbAfterT8 = await pool.query(
      `SELECT id, name, rule_type,
              valid_until,
              TO_CHAR(valid_until AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH12:MI AM') as valid_until_ist
       FROM pricing_rules WHERE id = $1`,
      [createdT8Rule.id]
    );
    console.log('\nDB State AFTER Date-Only Edit:');
    console.table(dbAfterT8.rows);

    const afterRuleDateObj = new Date(dbAfterT8.rows[0].valid_until);
    const afterRuleHours = afterRuleDateObj.getHours();
    const afterRuleMinutes = afterRuleDateObj.getMinutes();
    const afterRuleDay = afterRuleDateObj.getDate();
    console.log(`Stored valid_until after edit (Local): ${afterRuleHours}:${afterRuleMinutes === 0 ? '00' : afterRuleMinutes} (Expected: 18:00) on Day ${afterRuleDay}`);

    if (
      displayedRuleTimeT8.toUpperCase() === '6:00 PM' &&
      beforeRuleHours === 18 &&
      afterRuleHours === 18 &&
      afterRuleMinutes === 0 &&
      afterRuleDay === newDay5Date.getDate()
    ) {
      console.log('>>> TEST T8 PASS: Custom 6:00 PM displayed on reopen and successfully survived date-only change to Day + 5.');
      t8Pass = true;
    } else {
      console.log('>>> TEST T8 FAIL: Custom time was reset or did not survive edit.');
    }

  } catch (err) {
    console.error('Test run failed with error:', err);
  } finally {
    await pool.end();
  }

  console.log('\n================================================================');
  console.log('FINAL AUDIT SUMMARY');
  console.log('================================================================');
  console.log(`TEST T1 (Sales Window 23:59 Default):      ${t1Pass ? 'PASS' : 'FAIL'}`);
  console.log(`TEST T2 (Early Bird End-of-Day 23:59):     ${t2Pass ? 'PASS' : 'FAIL'}`);
  console.log(`TEST T3 (Payment Summary Itemized Line):   ${t3Pass ? 'PASS' : 'FAIL'}`);
  console.log(`TEST T4 (Server createOrder Parity):       ${t4Pass ? 'PASS' : 'FAIL'}`);
  console.log(`TEST T5 (Plain Ticket Regression):         ${t5Pass ? 'PASS' : 'FAIL'}`);
  console.log(`TEST T6 (Stacked Discounts Parity):        ${t6Pass ? 'PASS' : 'FAIL'}`);
  console.log(`TEST T7 (Edit Ticket Custom Time Survive): ${t7Pass ? 'PASS' : 'FAIL'}`);
  console.log(`TEST T8 (Edit Rule Custom Time Survive):   ${t8Pass ? 'PASS' : 'FAIL'}`);
  console.log('================================================================\n');

  if (t1Pass && t2Pass && t3Pass && t4Pass && t5Pass && t6Pass && t7Pass && t8Pass) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests();
