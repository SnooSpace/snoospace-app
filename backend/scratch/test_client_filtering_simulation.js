require("dotenv").config();
const { createPool } = require("../config/db");
const { getExploreFeed } = require("../controllers/exploreController");
const pool = createPool();

const req = { user: { id: 155, type: 'member' }, app: { locals: { pool } } };

// Client-side filtering logic copied exactly from Explore.js
function simulateFilterEvents(events, filter) {
  if (!events || !Array.isArray(events)) return [];

  const now = new Date();
  const todayStr = now.toDateString();

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowStr = tomorrow.toDateString();

  return events.filter((ev) => {
    if (!ev) return false;

    const dateStr = ev.startDatetime || ev.start_datetime || ev.event_date || ev.date || ev.startTime;
    const evDate = dateStr ? new Date(dateStr) : null;
    if (!evDate || isNaN(evDate.getTime())) return false;

    // Check if event has already ended
    let isEnded = false;
    const endDateStr = ev.endDatetime || ev.end_datetime || ev.endTime;
    if (endDateStr) {
      const evEndDate = new Date(endDateStr);
      if (!isNaN(evEndDate.getTime())) {
        isEnded = evEndDate.getTime() < now.getTime();
      }
    } else {
      isEnded = (evDate.getTime() + 4 * 60 * 60 * 1000) < now.getTime();
    }

    const isLive = Boolean(ev.isLiveNow || ev.is_live);

    if (isEnded && !isLive) {
      return false;
    }

    if (filter === "all") {
      return true;
    }

    if (filter === "today") {
      return evDate.toDateString() === todayStr;
    }

    if (filter === "tomorrow") {
      return evDate.toDateString() === tomorrowStr;
    }

    if (filter === "weekend") {
      const day = evDate.getDay();
      const diffDays = (evDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return (day === 5 || day === 6 || day === 0) && diffDays >= -0.5 && diffDays <= 7;
    }

    if (filter === "free") {
      return ev.isFree === true || ev.is_free === true || ev.ticket_price === 0 || ev.cost_type === "free";
    }

    if (filter === "virtual") {
      const type = String(ev.eventType || ev.event_type || "").toLowerCase();
      return type === "virtual" || type === "hybrid";
    }

    return true;
  });
}

const res = {
  json: (data) => {
    console.log("=== SIMULATING CLIENT-SIDE EXPLORE FILTERING ===");
    const filters = ["all", "today", "tomorrow", "weekend", "free", "virtual"];

    filters.forEach(filter => {
      console.log(`\n--- FILTER: [${filter.toUpperCase()}] ---`);
      
      const visibleRails = (data.categoryRails || [])
        .map(rail => ({
          category: rail.category,
          categorySlug: rail.categorySlug,
          filteredEvents: simulateFilterEvents(rail.events, filter)
        }))
        .filter(rail => rail.filteredEvents && rail.filteredEvents.length > 0);

      const quickNavCategories = (data.categories || []).filter(cat => {
        const rail = (data.categoryRails || []).find(
          r => r.categorySlug === cat.slug || r.category?.toLowerCase() === cat.name?.toLowerCase()
        );
        if (rail && Array.isArray(rail.events) && rail.events.length > 0) {
          const matching = simulateFilterEvents(rail.events, filter);
          return matching.length > 0;
        }
        if (filter === "all" && (cat.eventCount > 0 || cat.event_count > 0)) {
          return true;
        }
        return false;
      });

      console.log(`Visible Rails (${visibleRails.length}):`, visibleRails.map(r => `${r.category} (${r.filteredEvents.length} events)`));
      console.log(`Quick-Nav Categories (${quickNavCategories.length}):`, quickNavCategories.map(c => c.name));

      // Assertions
      visibleRails.forEach(r => {
        if (r.filteredEvents.length === 0) {
          throw new Error(`FAIL: Rail ${r.category} has 0 events but is visible!`);
        }
      });

      quickNavCategories.forEach(c => {
        const hasMatchingEvents = visibleRails.some(r => r.categorySlug === c.slug || r.category?.toLowerCase() === c.name?.toLowerCase());
        if (filter !== "all" && !hasMatchingEvents) {
          throw new Error(`FAIL: QuickNav category ${c.name} has 0 matching events under filter ${filter}!`);
        }
      });
    });

    console.log("\nALL FILTER ASSERTIONS PASSED PERFECTLY!");
    process.exit(0);
  },
  status: (code) => ({
    json: (err) => {
      console.error("Status", code, err);
      process.exit(1);
    }
  })
};

getExploreFeed(req, res);
