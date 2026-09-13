/**
 * pricingCalculator.js
 * Authoritative server-side pricing engine for SnooSpace events.
 *
 * Evaluates ticket base prices, active pricing_rules (early bird by time/volume, group discounts),
 * and discount_codes (promo codes) with complete concurrency, usage limit, and eligibility checks.
 */

/**
 * Calculate authoritative order pricing server-side.
 *
 * @param {Object} db - pg Pool or Client
 * @param {number|string} eventId - Target event ID
 * @param {Array} tickets - [{ ticketTypeId, quantity }]
 * @param {string|null} promoCode - Raw client-submitted promo code
 * @param {number|string|null} userId - Current authenticated member ID
 * @param {Object} options - Optional flags { sessionId, hasValidReservationHold }
 * @returns {Promise<Object>} Pricing summary & line item breakdown
 */
async function calculateOrderPricing(db, eventId, tickets, promoCode = null, userId = null, options = {}) {
  const parsedEventId = parseInt(eventId, 10);
  if (!parsedEventId || isNaN(parsedEventId)) {
    const err = new Error("Invalid event ID");
    err.statusCode = 400;
    throw err;
  }

  if (!tickets || !Array.isArray(tickets) || tickets.length === 0) {
    const err = new Error("No tickets selected");
    err.statusCode = 400;
    throw err;
  }

  // Sanitize ticket inputs
  const sanitizedItems = tickets.map((t) => {
    const ticketTypeId = parseInt(t.ticketTypeId, 10);
    const quantity = parseInt(t.quantity, 10);
    if (!ticketTypeId || isNaN(ticketTypeId) || !quantity || isNaN(quantity) || quantity <= 0) {
      const err = new Error(`Invalid ticket selection: type ${t.ticketTypeId}, quantity ${t.quantity}`);
      err.statusCode = 400;
      throw err;
    }
    return { ticketTypeId, quantity };
  });

  // 1. Fetch live ticket records from database
  const requestedIds = [...new Set(sanitizedItems.map((i) => i.ticketTypeId))];
  const ticketRes = await db.query(
    `SELECT id, name, base_price, total_quantity, sold_count, reserved_count,
            sale_start_at, sale_end_at, is_active, min_per_order, max_per_order
     FROM ticket_types
     WHERE event_id = $1 AND id = ANY($2::bigint[])`,
    [parsedEventId, requestedIds]
  );

  if (ticketRes.rows.length !== requestedIds.length) {
    const foundIds = new Set(ticketRes.rows.map((r) => parseInt(r.id, 10)));
    const missing = requestedIds.filter((id) => !foundIds.has(id));
    const err = new Error(`Invalid ticket type(s): ${missing.join(", ")}`);
    err.statusCode = 400;
    throw err;
  }

  const ticketMap = new Map(ticketRes.rows.map((r) => [parseInt(r.id, 10), r]));
  const now = new Date();

  // Validate active status and sales window (honoring existing hold if present)
  for (const item of sanitizedItems) {
    const ticket = ticketMap.get(item.ticketTypeId);
    if (!ticket.is_active) {
      const err = new Error(`Ticket "${ticket.name}" is not currently available`);
      err.statusCode = 400;
      throw err;
    }

    if (ticket.sale_start_at && new Date(ticket.sale_start_at) > now) {
      const err = new Error(`Sales haven't started yet for "${ticket.name}"`);
      err.statusCode = 400;
      throw err;
    }

    // Sales end window: if a valid hold is already held, allow completing checkout within hold
    if (ticket.sale_end_at && new Date(ticket.sale_end_at) < now) {
      if (!options.hasValidReservationHold) {
        const err = new Error(`Sales have ended for "${ticket.name}"`);
        err.statusCode = 400;
        throw err;
      }
    }
  }

  // 2. Fetch active pricing rules for event
  const pricingRulesRes = await db.query(
    `SELECT id, ticket_type_id, name, rule_type, discount_type, discount_value,
            quantity_threshold, min_quantity, valid_from, valid_until, priority,
            is_active, COALESCE(applies_to, 'all') as applies_to,
            COALESCE(selected_tickets, '[]'::jsonb) as selected_tickets
     FROM pricing_rules
     WHERE event_id = $1 AND is_active = true
     ORDER BY priority ASC`,
    [parsedEventId]
  );
  const pricingRules = pricingRulesRes.rows;

  // 3. Compute per-ticket pricing rule evaluation (mirrors pricingUtils.calculateEffectivePrice)
  let rawSubtotal = 0;
  let subtotalAfterPricingRules = 0;

  const intermediateBreakdown = sanitizedItems.map((item) => {
    const ticket = ticketMap.get(item.ticketTypeId);
    const basePrice = parseFloat(ticket.base_price) || 0;
    const quantity = item.quantity;
    const rawLine = basePrice * quantity;
    rawSubtotal += rawLine;

    if (basePrice === 0) {
      subtotalAfterPricingRules += 0;
      return {
        ticketTypeId: item.ticketTypeId,
        ticketName: ticket.name,
        quantity,
        basePrice: 0,
        effectivePrice: 0,
        pricingRuleDiscount: 0,
        appliedRuleName: null,
        appliedRuleType: null,
      };
    }

    // Filter applicable pricing rules for this ticket
    const applicableRules = pricingRules.filter((rule) => {
      if (!rule.is_active) return false;
      if (
        rule.applies_to === "specific" &&
        Array.isArray(rule.selected_tickets) &&
        rule.selected_tickets.length > 0
      ) {
        const match = rule.selected_tickets.some(
          (tid) =>
            String(tid) === String(ticket.id) || String(tid) === String(ticket.name)
        );
        if (!match) return false;
      }
      return rule.ticket_type_id === null || String(rule.ticket_type_id) === String(ticket.id);
    });

    let bestDiscount = 0;
    let bestRule = null;

    for (const rule of applicableRules) {
      let ruleApplies = false;

      if (rule.rule_type === "early_bird_time") {
        if (rule.valid_until) {
          ruleApplies = now < new Date(rule.valid_until);
        }
        if (rule.valid_from && ruleApplies) {
          ruleApplies = now >= new Date(rule.valid_from);
        }
      } else if (rule.rule_type === "early_bird_quantity") {
        const soldCount = ticket.sold_count || 0;
        const threshold = rule.quantity_threshold || 0;
        ruleApplies = soldCount < threshold;
      } else if (rule.rule_type === "group_discount") {
        const minQty = parseInt(rule.min_quantity, 10) || 2;
        ruleApplies = quantity >= minQty;
      }

      if (ruleApplies) {
        let discountAmount = 0;
        if (rule.discount_type === "percentage") {
          discountAmount = (basePrice * parseFloat(rule.discount_value)) / 100;
        } else {
          discountAmount = Math.min(parseFloat(rule.discount_value), basePrice);
        }

        if (discountAmount > bestDiscount) {
          bestDiscount = discountAmount;
          bestRule = rule;
        }
      }
    }

    const effectivePrice = Math.max(0, Math.round(basePrice - bestDiscount));
    const pricingRuleDiscountPerUnit = basePrice - effectivePrice;
    subtotalAfterPricingRules += effectivePrice * quantity;

    return {
      ticketTypeId: item.ticketTypeId,
      ticketName: ticket.name,
      quantity,
      basePrice,
      effectivePrice,
      pricingRuleDiscount: pricingRuleDiscountPerUnit * quantity,
      appliedRuleName: bestRule?.name || null,
      appliedRuleType: bestRule?.rule_type || null,
    };
  });

  const totalPricingRulesDiscount = rawSubtotal - subtotalAfterPricingRules;

  // 4. Promo Code Validation & Calculation
  let validatedPromoCode = null;
  let promoCodeId = null;
  let promoDiscount = 0;
  let promoDiscountType = null;
  let promoDiscountValue = 0;

  if (promoCode && typeof promoCode === "string" && promoCode.trim().length > 0) {
    const normalized = promoCode.toUpperCase().trim();

    const codeRes = await db.query(
      `SELECT id, code, code_normalized, discount_type, discount_value,
              max_uses, current_uses, max_uses_per_user, valid_from, valid_until,
              min_cart_value, applicable_ticket_ids, is_active,
              COALESCE(applies_to, 'all') as applies_to,
              COALESCE(selected_tickets, '[]'::jsonb) as selected_tickets
       FROM discount_codes
       WHERE event_id = $1 AND code_normalized = $2`,
      [parsedEventId, normalized]
    );

    if (codeRes.rows.length === 0) {
      const err = new Error("Promo code not found");
      err.code = "promo_not_found";
      err.statusCode = 400;
      throw err;
    }

    const dc = codeRes.rows[0];

    if (dc.is_active === false) {
      const err = new Error("Promo code is inactive");
      err.code = "promo_inactive";
      err.statusCode = 400;
      throw err;
    }

    // Date validity check
    if (dc.valid_from && now < new Date(dc.valid_from)) {
      const err = new Error("Promo code is not yet active");
      err.code = "promo_not_active_yet";
      err.statusCode = 400;
      throw err;
    }
    if (dc.valid_until && now > new Date(dc.valid_until)) {
      const err = new Error("Promo code has expired");
      err.code = "promo_expired";
      err.statusCode = 400;
      throw err;
    }

    // Minimum cart value check
    if (dc.min_cart_value && parseFloat(dc.min_cart_value) > 0) {
      if (subtotalAfterPricingRules < parseFloat(dc.min_cart_value)) {
        const err = new Error("Order total does not meet the minimum requirement for this promo code");
        err.code = "promo_min_order_unmet";
        err.statusCode = 400;
        throw err;
      }
    }

    // Max uses check with active pending holds (Follow-Up 1)
    if (dc.max_uses !== null) {
      const parsedUserId = userId ? parseInt(userId, 10) : null;
      const pendingRes = await db.query(
        `SELECT COUNT(DISTINCT ro.id)::int AS pending_count
         FROM razorpay_orders ro
         WHERE ro.event_id = $1
           AND ro.notes->>'promoCode' = $2
           AND ro.status = 'created'
           AND (ro.user_id != $3 OR $3 IS NULL)
           AND EXISTS (
             SELECT 1 FROM ticket_reservations tr
             WHERE tr.session_id = ro.notes->>'sessionId'
               AND tr.expires_at > NOW()
           )`,
        [parsedEventId, dc.code, parsedUserId]
      );
      const pendingCount = pendingRes.rows[0]?.pending_count || 0;
      const totalInFlight = (dc.current_uses || 0) + pendingCount;

      if (totalInFlight >= dc.max_uses) {
        const err = new Error("This promo code has reached its maximum usage limit");
        err.code = "promo_limit_reached";
        err.statusCode = 400;
        throw err;
      }
    }

    // Per-user usage limit check
    if (dc.max_uses_per_user !== null && userId) {
      const userUsageRes = await db.query(
        `SELECT COUNT(*)::int AS user_uses
         FROM event_registrations
         WHERE event_id = $1 AND member_id = $2
           AND UPPER(TRIM(promo_code)) = $3
           AND registration_status != 'cancelled'`,
        [parsedEventId, parseInt(userId, 10), normalized]
      );
      const userUses = userUsageRes.rows[0]?.user_uses || 0;
      if (userUses >= dc.max_uses_per_user) {
        const err = new Error("You have reached the maximum uses for this promo code");
        err.code = "promo_limit_reached";
        err.statusCode = 400;
        throw err;
      }
    }

    // Eligible tickets check
    let discountableAmount = 0;
    if (dc.applies_to === "specific" && dc.selected_tickets && dc.selected_tickets.length > 0) {
      const eligibleItems = intermediateBreakdown.filter((item) =>
        dc.selected_tickets.some(
          (tid) =>
            String(tid) === String(item.ticketTypeId) || String(tid) === String(item.ticketName)
        )
      );

      if (eligibleItems.length === 0) {
        const err = new Error("This promo code is not applicable to the selected tickets");
        err.code = "promo_not_applicable";
        err.statusCode = 400;
        throw err;
      } else {
        discountableAmount = eligibleItems.reduce(
          (sum, i) => sum + i.effectivePrice * i.quantity,
          0
        );
      }
    } else {
      // Applies to all tickets
      discountableAmount = subtotalAfterPricingRules;
    }

    if (discountableAmount > 0) {
      validatedPromoCode = dc.code;
      promoCodeId = dc.id;
      promoDiscountType = dc.discount_type;
      promoDiscountValue = parseFloat(dc.discount_value);

      if (dc.discount_type === "percentage") {
        promoDiscount = (discountableAmount * promoDiscountValue) / 100;
      } else {
        promoDiscount = Math.min(promoDiscountValue, discountableAmount);
      }
      promoDiscount = Math.round(promoDiscount * 100) / 100;
    }
  }

  // 5. Final total calculations
  const finalAmount = Math.max(0, Math.round(subtotalAfterPricingRules - promoDiscount));
  const totalDiscount = Math.max(0, rawSubtotal - finalAmount);

  // 6. Prorate promo discount across line items so line totals sum exactly to finalAmount
  let remainingLineDiff = finalAmount;
  const ticketBreakdown = intermediateBreakdown.map((item, idx) => {
    let lineFinalTotal;
    if (idx === intermediateBreakdown.length - 1) {
      // Last item absorbs any rounding difference to ensure exact sum
      lineFinalTotal = remainingLineDiff;
    } else {
      if (subtotalAfterPricingRules > 0) {
        const lineShareRatio = (item.effectivePrice * item.quantity) / subtotalAfterPricingRules;
        lineFinalTotal = Math.round(finalAmount * lineShareRatio);
      } else {
        lineFinalTotal = 0;
      }
      remainingLineDiff -= lineFinalTotal;
    }

    const unitPrice = item.quantity > 0 ? Math.round((lineFinalTotal / item.quantity) * 100) / 100 : 0;

    return {
      ticketTypeId: item.ticketTypeId,
      ticketName: item.ticketName,
      quantity: item.quantity,
      basePrice: item.basePrice,
      effectivePrice: item.effectivePrice,
      pricingRuleDiscount: item.pricingRuleDiscount,
      unitPrice,
      lineTotal: lineFinalTotal,
      appliedRuleName: item.appliedRuleName,
      appliedRuleType: item.appliedRuleType,
    };
  });

  return {
    rawSubtotal,
    pricingRulesDiscount: totalPricingRulesDiscount,
    promoDiscount,
    totalDiscount,
    finalAmount,
    validatedPromoCode,
    promoCodeId,
    promoDiscountType,
    promoDiscountValue,
    ticketBreakdown,
  };
}

module.exports = {
  calculateOrderPricing,
};
