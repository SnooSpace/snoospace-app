const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_PER_WINDOW_PER_IP = 10;
const MAX_PER_WINDOW_PER_EMAIL = 5;

const ipActivity = new Map();
const emailActivity = new Map();

function prune(map, now) {
  for (const [key, events] of map.entries()) {
    const filtered = events.filter(ts => now - ts < WINDOW_MS);
    if (filtered.length === 0) {
      map.delete(key);
    } else {
      map.set(key, filtered);
    }
  }
}

function track(map, key, now) {
  const events = map.get(key) || [];
  events.push(now);
  map.set(key, events);
  return events;
}

function rateLimitOtp(req, res, next) {
  const now = Date.now();
  prune(ipActivity, now);
  prune(emailActivity, now);

  const ip = req.ip || req.connection.remoteAddress || "unknown";
  const email = (req.body && typeof req.body.email === 'string') ? req.body.email.trim().toLowerCase() : undefined;

  const ipEvents = track(ipActivity, ip, now);
  if (ipEvents.length > MAX_PER_WINDOW_PER_IP) {
    return res.status(429).json({ error: "Too many requests from this IP. Please try again later." });
  }

  if (email) {
    const emailEvents = track(emailActivity, email, now);
    if (emailEvents.length > MAX_PER_WINDOW_PER_EMAIL) {
      return res.status(429).json({ error: "Too many requests for this email. Please try again later." });
    }
  }

  next();
}

module.exports = { rateLimitOtp };