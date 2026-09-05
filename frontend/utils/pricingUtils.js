/**
 * Calculate effective ticket price after applying discounts (early bird, group/bulk discounts)
 *
 * @param {Object} ticket - Ticket type object with base_price
 * @param {Array} pricingRules - Array of pricing rules for the event
 * @param {number} quantity - Quantity of this ticket currently selected (default: 1)
 * @returns {Object} { effectivePrice, originalPrice, discount, discountLabel, hasDiscount, ruleName, ruleType, groupDiscountHint }
 */
export function calculateEffectivePrice(ticket, pricingRules = [], quantity = 1) {
  const basePrice = parseFloat(ticket?.base_price) || 0;

  if (basePrice === 0) {
    return {
      effectivePrice: 0,
      originalPrice: 0,
      discount: 0,
      discountLabel: null,
      hasDiscount: false,
      ruleType: null,
      groupDiscountHint: null,
    };
  }

  // Filter active rules for this ticket (or all tickets if ticket_type_id is null)
  const applicableRules = (pricingRules || []).filter((rule) => {
    if (!rule.is_active) return false;
    // Check applies_to and selected_tickets if present
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
    // Rule applies to all tickets (null) or specifically this ticket
    return rule.ticket_type_id === null || String(rule.ticket_type_id) === String(ticket.id);
  });

  if (applicableRules.length === 0) {
    return {
      effectivePrice: Math.round(basePrice),
      originalPrice: Math.round(basePrice),
      discount: 0,
      discountLabel: null,
      hasDiscount: false,
      ruleType: null,
      groupDiscountHint: null,
    };
  }

  // Find any potential group discount hint if quantity threshold is not yet reached
  let groupDiscountHint = null;
  const groupRules = applicableRules
    .filter((r) => r.rule_type === "group_discount")
    .sort((a, b) => (parseInt(a.min_quantity, 10) || 2) - (parseInt(b.min_quantity, 10) || 2));

  // Find next tier of group discount that hasn't been met yet
  const nextGroupRule = groupRules.find(
    (r) => (parseInt(r.min_quantity, 10) || 2) > quantity
  );
  if (nextGroupRule) {
    const minQty = parseInt(nextGroupRule.min_quantity, 10) || 2;
    const numVal = parseFloat(nextGroupRule.discount_value);
    const formattedVal = numVal % 1 === 0 ? numVal.toFixed(0) : numVal.toFixed(1);
    const label =
      nextGroupRule.discount_type === "percentage"
        ? `${formattedVal}% off`
        : `₹${formattedVal} off`;
    groupDiscountHint = {
      minQuantity: minQty,
      discountLabel: label,
      ruleName: nextGroupRule.name,
      text: `Buy ${minQty}+ to get ${label}`,
    };
  }

  // Sort by priority (lower = higher priority)
  const sortedRules = [...applicableRules].sort(
    (a, b) => (a.priority || 100) - (b.priority || 100)
  );

  let bestDiscount = 0;
  let bestRule = null;

  for (const rule of sortedRules) {
    let ruleApplies = false;

    // Check if rule conditions are met
    if (rule.rule_type === "early_bird_time") {
      // Time-based: valid if current time is before valid_until
      if (rule.valid_until) {
        const now = new Date();
        const validUntil = new Date(rule.valid_until);
        ruleApplies = now < validUntil;
      }
      // Also check valid_from if present
      if (rule.valid_from && ruleApplies) {
        const validFrom = new Date(rule.valid_from);
        const now = new Date();
        ruleApplies = now >= validFrom;
      }
    } else if (rule.rule_type === "early_bird_quantity") {
      // Quantity-based: valid if sold_count < quantity_threshold
      const soldCount = ticket.sold_count || 0;
      const threshold = rule.quantity_threshold || 0;
      ruleApplies = soldCount < threshold;
    } else if (rule.rule_type === "group_discount") {
      // Group/Bulk discount: valid if purchased quantity >= min_quantity
      const minQty = parseInt(rule.min_quantity, 10) || 2;
      ruleApplies = quantity >= minQty;
    }

    if (ruleApplies) {
      // Calculate discount amount
      let discountAmount = 0;
      if (rule.discount_type === "percentage") {
        discountAmount = (basePrice * parseFloat(rule.discount_value)) / 100;
      } else {
        // Flat discount per ticket
        discountAmount = Math.min(parseFloat(rule.discount_value), basePrice);
      }

      // Keep the best (highest) discount
      if (discountAmount > bestDiscount) {
        bestDiscount = discountAmount;
        bestRule = rule;
      }
    }
  }

  if (bestDiscount > 0 && bestRule) {
    const effectivePrice = Math.max(0, Math.round(basePrice - bestDiscount));
    const numVal = parseFloat(bestRule.discount_value);
    const formattedVal = numVal % 1 === 0 ? numVal.toFixed(0) : numVal.toFixed(1);
    const discountLabel =
      bestRule.discount_type === "percentage"
        ? `${formattedVal}% off`
        : `₹${formattedVal} off`;

    return {
      effectivePrice,
      originalPrice: Math.round(basePrice),
      discount: bestDiscount,
      discountLabel,
      hasDiscount: true,
      ruleName: bestRule.name,
      ruleType: bestRule.rule_type,
      groupDiscountHint,
    };
  }

  return {
    effectivePrice: Math.round(basePrice),
    originalPrice: Math.round(basePrice),
    discount: 0,
    discountLabel: null,
    hasDiscount: false,
    ruleType: null,
    groupDiscountHint,
  };
}

/**
 * Format price with INR formatting
 */
export function formatPrice(price) {
  if (price === 0) return "Free";
  return `₹${price.toLocaleString("en-IN")}`;
}
