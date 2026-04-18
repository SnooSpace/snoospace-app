/**
 * Per-occupation sub-field definitions for Edit Profile.
 *
 * Each occupation maps to an array of field objects:
 *   key          - stored in occupation_details JSONB
 *   label        - section label (uppercase, matches app style)
 *   placeholder  - hint text
 *   keyboardType - optional RN keyboard type (defaults to "default")
 *   optional     - explicit optional marker shown in UI (all fields are optional by default)
 *
 * Portfolio link is a UNIVERSAL field and handled separately — not repeated here.
 * Occupations that surface a portfolio link are listed in PORTFOLIO_OCCUPATIONS.
 */

// ─── PER-OCCUPATION SUB-FIELDS ─────────────────────────────────────────
export const OCCUPATION_SUBFIELDS = {
  // ── Education ────────────────────────────────────
  student: [
    { key: "institution", label: "COLLEGE / UNIVERSITY", placeholder: "Where do you study?" },
    { key: "degree", label: "DEGREE / MAJOR", placeholder: "e.g. B.Tech Computer Science" },
    { key: "graduation_year", label: "GRADUATION YEAR", placeholder: "e.g. 2026", keyboardType: "number-pad" },
  ],
  researcher: [
    { key: "institution", label: "INSTITUTION / ORGANIZATION", placeholder: "Where do you research?" },
    { key: "field", label: "FIELD OF RESEARCH", placeholder: "e.g. Machine Learning, Neuroscience" },
    { key: "current_project", label: "CURRENT PROJECT", placeholder: "What are you working on?", optional: true },
  ],
  educator: [
    { key: "institution", label: "SCHOOL / INSTITUTION", placeholder: "Where do you teach?" },
    { key: "subject", label: "SUBJECT / GRADE LEVEL", placeholder: "e.g. Math, Grade 10" },
  ],
  professor: [
    { key: "institution", label: "UNIVERSITY", placeholder: "Which university?" },
    { key: "department", label: "DEPARTMENT", placeholder: "e.g. Computer Science" },
    { key: "research_interests", label: "RESEARCH INTERESTS", placeholder: "e.g. AI, Robotics", optional: true },
  ],

  // ── Professional ─────────────────────────────────
  engineer: [
    { key: "company", label: "COMPANY", placeholder: "Where do you work?" },
    { key: "discipline", label: "ENGINEERING DISCIPLINE", placeholder: "e.g. Software, Civil, Mechanical" },
    { key: "years_experience", label: "YEARS OF EXPERIENCE", placeholder: "e.g. 3", keyboardType: "number-pad" },
  ],
  designer: [
    { key: "company", label: "COMPANY / STUDIO", placeholder: "Where do you design?" },
    { key: "discipline", label: "DESIGN DISCIPLINE", placeholder: "e.g. UI/UX, Graphic, Industrial" },
  ],
  developer: [
    { key: "company", label: "COMPANY", placeholder: "Where do you work?" },
    { key: "tech_stack", label: "TECH STACK", placeholder: "e.g. React, Python, AWS" },
    { key: "years_experience", label: "YEARS OF EXPERIENCE", placeholder: "e.g. 3", keyboardType: "number-pad" },
  ],
  product_manager: [
    { key: "company", label: "COMPANY", placeholder: "Where do you work?" },
    { key: "industry", label: "INDUSTRY", placeholder: "e.g. Fintech, Healthcare" },
    { key: "product_area", label: "PRODUCT AREA", placeholder: "e.g. Payments, Growth" },
  ],
  data_analyst: [
    { key: "company", label: "COMPANY", placeholder: "Where do you work?" },
    { key: "industry", label: "INDUSTRY", placeholder: "e.g. E-commerce, Finance" },
    { key: "tools", label: "TOOLS", placeholder: "e.g. SQL, Python, Tableau" },
  ],
  marketer: [
    { key: "company", label: "COMPANY", placeholder: "Where do you work?" },
    { key: "specialization", label: "SPECIALIZATION", placeholder: "e.g. Growth, Brand, Content" },
  ],
  sales: [
    { key: "company", label: "COMPANY", placeholder: "Where do you work?" },
    { key: "industry", label: "INDUSTRY", placeholder: "e.g. SaaS, Real Estate" },
  ],
  finance: [
    { key: "company", label: "COMPANY", placeholder: "Where do you work?" },
    { key: "specialization", label: "SPECIALIZATION", placeholder: "e.g. Banking, Accounting, VC" },
  ],
  lawyer: [
    { key: "firm", label: "FIRM / ORGANIZATION", placeholder: "Where do you practice?" },
    { key: "practice_area", label: "PRACTICE AREA", placeholder: "e.g. Corporate, IP, Litigation" },
  ],
  consultant: [
    { key: "firm", label: "FIRM", placeholder: "Where do you consult?" },
    { key: "consulting_area", label: "CONSULTING AREA", placeholder: "e.g. Strategy, Management, IT" },
  ],
  hr: [
    { key: "company", label: "COMPANY", placeholder: "Where do you work?" },
    { key: "specialization", label: "HR SPECIALIZATION", placeholder: "e.g. Talent, L&D, Culture" },
  ],
  operations: [
    { key: "company", label: "COMPANY", placeholder: "Where do you work?" },
    { key: "industry", label: "INDUSTRY", placeholder: "e.g. Logistics, Manufacturing" },
  ],
  executive: [
    { key: "company", label: "COMPANY", placeholder: "Where do you lead?" },
    { key: "title", label: "TITLE", placeholder: "e.g. CEO, COO, Director" },
    { key: "industry", label: "INDUSTRY", placeholder: "e.g. Tech, Healthcare" },
  ],

  // ── Healthcare & Science ─────────────────────────
  doctor: [
    { key: "hospital", label: "HOSPITAL / CLINIC", placeholder: "Where do you practice?" },
    { key: "specialization", label: "SPECIALIZATION", placeholder: "e.g. Cardiology, Pediatrics" },
  ],
  nurse: [
    { key: "hospital", label: "HOSPITAL / CLINIC", placeholder: "Where do you work?" },
    { key: "department", label: "DEPARTMENT", placeholder: "e.g. ICU, Emergency, Pediatrics" },
  ],
  pharmacist: [
    { key: "organization", label: "ORGANIZATION", placeholder: "Where do you work?" },
    { key: "specialization", label: "SPECIALIZATION", placeholder: "e.g. Clinical, Retail, Research" },
  ],
  therapist: [
    { key: "practice", label: "PRACTICE / ORGANIZATION", placeholder: "Where do you practice?" },
    { key: "therapy_type", label: "THERAPY TYPE", placeholder: "e.g. CBT, Couples, Occupational" },
  ],
  scientist: [
    { key: "institution", label: "INSTITUTION", placeholder: "Where do you research?" },
    { key: "field", label: "FIELD", placeholder: "e.g. Biology, Chemistry, Physics" },
  ],

  // ── Creative & Media ─────────────────────────────
  artist: [
    { key: "medium", label: "MEDIUM", placeholder: "e.g. Painting, Sculpture, Digital" },
  ],
  photographer: [
    { key: "specialization", label: "SPECIALIZATION", placeholder: "e.g. Portrait, Wedding, Commercial" },
  ],
  filmmaker: [
    { key: "studio", label: "STUDIO / FREELANCE", placeholder: "Where do you work?" },
    { key: "genre", label: "GENRE", placeholder: "e.g. Documentary, Commercial, Narrative" },
  ],
  writer: [
    { key: "publication", label: "PUBLICATION / FREELANCE", placeholder: "Where do you write?" },
    { key: "genre", label: "GENRE / BEAT", placeholder: "e.g. Fiction, Tech, Sports" },
  ],
  musician: [
    { key: "genre", label: "GENRE", placeholder: "e.g. Jazz, Classical, Hip-Hop" },
    { key: "instruments", label: "INSTRUMENTS", placeholder: "e.g. Guitar, Piano, Vocals" },
    { key: "band_project", label: "BAND / PROJECT NAME", placeholder: "Your band or project", optional: true },
  ],
  content_creator: [
    { key: "platform", label: "PLATFORM", placeholder: "e.g. YouTube, Instagram, TikTok" },
    { key: "niche", label: "NICHE", placeholder: "e.g. Tech, Travel, Lifestyle" },
    { key: "handle", label: "HANDLE / LINK", placeholder: "@yourhandle or URL" },
  ],

  // ── Entrepreneurship ─────────────────────────────
  founder: [
    { key: "company", label: "STARTUP / COMPANY NAME", placeholder: "What are you building?" },
    { key: "industry", label: "INDUSTRY", placeholder: "e.g. Fintech, EdTech, Health" },
    { key: "stage", label: "STAGE", placeholder: "e.g. Idea, MVP, Growth, Funded" },
  ],
  freelancer: [
    { key: "field", label: "FIELD", placeholder: "e.g. Design, Writing, Development" },
    { key: "skills", label: "SKILLS", placeholder: "e.g. Branding, React, Copywriting" },
  ],
  investor: [
    { key: "firm", label: "FIRM", placeholder: "Where do you invest from?" },
    { key: "focus", label: "INVESTMENT FOCUS", placeholder: "e.g. Seed-stage SaaS, Consumer" },
  ],

  // ── Trades & Services ────────────────────────────
  technician: [
    { key: "field", label: "FIELD", placeholder: "e.g. IT, Electronics, HVAC" },
    { key: "company", label: "COMPANY", placeholder: "Where do you work?" },
  ],
  contractor: [
    { key: "trade", label: "TRADE", placeholder: "e.g. Plumbing, Electrical, General" },
    { key: "company", label: "COMPANY", placeholder: "Your company or independent" },
  ],
  chef: [
    { key: "restaurant", label: "RESTAURANT / ORGANIZATION", placeholder: "Where do you cook?" },
    { key: "cuisine", label: "CUISINE SPECIALTY", placeholder: "e.g. Italian, Japanese, Pastry" },
  ],
  retail: [
    { key: "company", label: "COMPANY", placeholder: "Where do you work?" },
    { key: "role", label: "ROLE", placeholder: "e.g. Store Manager, Buyer" },
  ],
  driver: [
    { key: "company", label: "COMPANY / PLATFORM", placeholder: "e.g. Uber, FedEx, Independent" },
    { key: "vehicle_type", label: "VEHICLE TYPE", placeholder: "e.g. Truck, Delivery, Rideshare" },
  ],

  // ── Other category ───────────────────────────────
  ngo: [
    { key: "organization", label: "ORGANIZATION", placeholder: "Which NGO / non-profit?" },
    { key: "cause_area", label: "CAUSE AREA", placeholder: "e.g. Education, Environment, Health" },
  ],
  government: [
    { key: "department", label: "DEPARTMENT / MINISTRY", placeholder: "Which department?" },
    { key: "role", label: "ROLE", placeholder: "Your role" },
  ],
  military: [
    { key: "branch", label: "BRANCH", placeholder: "e.g. Army, Navy, Air Force" },
    { key: "role", label: "ROLE", placeholder: "Your role (broad)" },
  ],
  homemaker: [],
  job_seeking: [
    { key: "field", label: "FIELD / INDUSTRY", placeholder: "What field interests you?" },
    { key: "open_to", label: "OPEN TO", placeholder: "e.g. Full-time, Freelance, Internship" },
  ],
  other: [], // Handled via category picker → CATEGORY_GENERIC_FIELDS
};


// ─── CATEGORY GENERIC FIELDS (for "Other" → category picker flow) ──────
// When user selects "Other" and then picks a category, these simplified
// fields are shown based on their chosen category.
export const CATEGORY_GENERIC_FIELDS = {
  EDUCATION: [
    { key: "institution", label: "INSTITUTION", placeholder: "Where do you study / work?" },
    { key: "field", label: "FIELD OF STUDY", placeholder: "e.g. Computer Science, Biology" },
  ],
  PROFESSIONAL: [
    { key: "company", label: "COMPANY", placeholder: "Where do you work?" },
    { key: "industry", label: "INDUSTRY", placeholder: "e.g. Tech, Finance, Healthcare" },
    { key: "specialization", label: "SPECIALIZATION", placeholder: "Your area of focus" },
  ],
  HEALTHCARE: [
    { key: "organization", label: "ORGANIZATION / PRACTICE", placeholder: "Where do you work?" },
    { key: "specialization", label: "SPECIALIZATION", placeholder: "Your area of focus" },
  ],
  CREATIVE: [
    { key: "medium", label: "MEDIUM / PLATFORM", placeholder: "e.g. Film, Design, Writing" },
  ],
  ENTREPRENEURSHIP: [
    { key: "company", label: "COMPANY / PROJECT", placeholder: "What are you building?" },
    { key: "industry", label: "INDUSTRY", placeholder: "e.g. Tech, Health, Education" },
  ],
  TRADES: [
    { key: "company", label: "COMPANY", placeholder: "Where do you work?" },
    { key: "specialization", label: "TRADE / SPECIALIZATION", placeholder: "Your area of focus" },
  ],
  OTHER: [
    { key: "organization", label: "ORGANIZATION", placeholder: "Where do you work?", optional: true },
  ],
};


// ─── PORTFOLIO OCCUPATIONS ─────────────────────────────────────────────
// Occupations where the universal portfolio_link should be surfaced.
export const PORTFOLIO_OCCUPATIONS = [
  "designer",
  "artist",
  "photographer",
  "filmmaker",
  "writer",
  "musician",
  "content_creator",
  "freelancer",
];

// Also surface portfolio for "Other" if category is CREATIVE
export const PORTFOLIO_CATEGORIES = ["CREATIVE"];


// ─── HELPERS ───────────────────────────────────────────────────────────

/**
 * Get sub-fields for an occupation value.
 * Falls back to empty array for unknown occupations.
 */
export const getSubFieldsForOccupation = (occupationValue) => {
  if (!occupationValue || occupationValue === "other") return [];
  return OCCUPATION_SUBFIELDS[occupationValue] || [];
};

/**
 * Get generic sub-fields for a category (used with "Other" flow).
 */
export const getSubFieldsForCategory = (categoryKey) => {
  if (!categoryKey) return [];
  return CATEGORY_GENERIC_FIELDS[categoryKey] || [];
};

/**
 * Check if portfolio link should be shown for a given occupation/category.
 */
export const shouldShowPortfolio = (occupationValue, occupationCategory) => {
  if (PORTFOLIO_OCCUPATIONS.includes(occupationValue)) return true;
  if (occupationValue === "other" && PORTFOLIO_CATEGORIES.includes(occupationCategory)) return true;
  return false;
};
