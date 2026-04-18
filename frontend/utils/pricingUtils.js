/**
 * Calculate effective ticket price after applying early bird discounts
 *
 * @param {Object} ticket - Ticket type object with base_price
 * @param {Array} pricingRules - Array of pricing rules for the event
 * @returns {Object} { effectivePrice, originalPrice, discount, discountLabel }
 */
export function calculateEffectivePrice(ticket, pricingRules = []) {
  const basePrice = parseFloat(ticket.base_price) || 0;

  if (basePrice === 0) {
    return {
      effectivePrice: 0,
      originalPrice: 0,
      discount: 0,
      discountLabel: null,
      hasDiscount: false,
    };
  }

  // Filter active rules for this ticket (or all tickets if ticket_type_id is null)
  const applicableRules = pricingRules.filter((rule) => {
    if (!rule.is_active) return false;
    // Rule applies to all tickets (null) or specifically this ticket
    return rule.ticket_type_id === null || rule.ticket_type_id === ticket.id;
  });

  if (applicableRules.length === 0) {
    return {
      effectivePrice: basePrice,
      originalPrice: basePrice,
      discount: 0,
      discountLabel: null,
      hasDiscount: false,
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
    }

    if (ruleApplies) {
      // Calculate discount amount
      let discountAmount = 0;
      if (rule.discount_type === "percentage") {
        discountAmount = (basePrice * parseFloat(rule.discount_value)) / 100;
      } else {
        // Flat discount
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
    const effectivePrice = Math.max(0, basePrice - bestDiscount);
    const discountLabel =
      bestRule.discount_type === "percentage"
        ? `${bestRule.discount_value}% off`
        : `₹${bestRule.discount_value} off`;

    return {
      effectivePrice,
      originalPrice: basePrice,
      discount: bestDiscount,
      discountLabel,
      hasDiscount: true,
      ruleName: bestRule.name,
    };
  }

  return {
    effectivePrice: basePrice,
    originalPrice: basePrice,
    discount: 0,
    discountLabel: null,
    hasDiscount: false,
  };
}

/**
 * Format price with INR formatting
 */
export function formatPrice(price) {
  if (price === 0) return "Free";
  return `₹${price.toLocaleString("en-IN")}`;
}
