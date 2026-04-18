import {
  GraduationCap,
  Briefcase,
  HeartPulse,
  Palette,
  Rocket,
  Wrench,
  MoreHorizontal,
} from "lucide-react-native";

/**
 * Occupation categories for signup flow.
 * Each occupation has a `value` (snake_case, stored in DB) and `label` (display text).
 */
export const OCCUPATION_CATEGORIES = {
  EDUCATION: {
    label: "Education",
    bg: "#E8F5E9",
    text: "#2E7D32",
    icon: GraduationCap,
    occupations: [
      { value: "student", label: "Student" },
      { value: "researcher", label: "Researcher" },
      { value: "educator", label: "Educator / Teacher" },
      { value: "professor", label: "Professor / Lecturer" },
    ],
  },
  PROFESSIONAL: {
    label: "Professional",
    bg: "#E3F2FD",
    text: "#1565C0",
    icon: Briefcase,
    occupations: [
      { value: "engineer", label: "Engineer" },
      { value: "designer", label: "Designer" },
      { value: "developer", label: "Developer" },
      { value: "product_manager", label: "Product Manager" },
      { value: "data_analyst", label: "Data / Analytics" },
      { value: "marketer", label: "Marketing" },
      { value: "sales", label: "Sales" },
      { value: "finance", label: "Finance & Accounting" },
      { value: "lawyer", label: "Legal" },
      { value: "consultant", label: "Consultant" },
      { value: "hr", label: "HR / People Ops" },
      { value: "operations", label: "Operations" },
      { value: "executive", label: "Executive / Leadership" },
    ],
  },
  HEALTHCARE: {
    label: "Healthcare & Science",
    bg: "#FCE4EC",
    text: "#C2185B",
    icon: HeartPulse,
    occupations: [
      { value: "doctor", label: "Doctor / Physician" },
      { value: "nurse", label: "Nurse / Paramedic" },
      { value: "pharmacist", label: "Pharmacist" },
      { value: "therapist", label: "Therapist / Counselor" },
      { value: "scientist", label: "Scientist" },
    ],
  },
  CREATIVE: {
    label: "Creative & Media",
    bg: "#F3E5F5",
    text: "#7B1FA2",
    icon: Palette,
    occupations: [
      { value: "artist", label: "Artist" },
      { value: "photographer", label: "Photographer" },
      { value: "filmmaker", label: "Filmmaker / Editor" },
      { value: "writer", label: "Writer / Journalist" },
      { value: "musician", label: "Musician" },
      { value: "content_creator", label: "Content Creator" },
    ],
  },
  ENTREPRENEURSHIP: {
    label: "Entrepreneurship",
    bg: "#FFF3E0",
    text: "#E65100",
    icon: Rocket,
    occupations: [
      { value: "founder", label: "Founder / Co-founder" },
      { value: "freelancer", label: "Freelancer" },
      { value: "investor", label: "Investor" },
    ],
  },
  TRADES: {
    label: "Trades & Services",
    bg: "#FFF8E1",
    text: "#F57F17",
    icon: Wrench,
    occupations: [
      { value: "technician", label: "Technician" },
      { value: "contractor", label: "Contractor / Builder" },
      { value: "chef", label: "Chef / Culinary" },
      { value: "retail", label: "Retail / Hospitality" },
      { value: "driver", label: "Driver / Logistics" },
    ],
  },
  OTHER: {
    label: "Other",
    bg: "#F5F5F5",
    text: "#424242",
    icon: MoreHorizontal,
    occupations: [
      { value: "ngo", label: "NGO / Non-profit" },
      { value: "government", label: "Government / Public Sector" },
      { value: "military", label: "Military / Defense" },
      { value: "homemaker", label: "Homemaker" },
      { value: "job_seeking", label: "Looking for Opportunities" },
      { value: "other", label: "Other" },
    ],
  },
};

/**
 * Get all occupations as a flat array of { value, label, category }
 */
export const getAllOccupations = () => {
  const all = [];
  Object.entries(OCCUPATION_CATEGORIES).forEach(([key, category]) => {
    category.occupations.forEach((occ) => {
      all.push({ ...occ, category: key });
    });
  });
  return all;
};

/**
 * Get display label for a stored occupation value
 */
export const getOccupationLabel = (value) => {
  if (!value) return null;
  const all = getAllOccupations();
  const found = all.find((o) => o.value === value);
  return found ? found.label : value;
};

/**
 * Get category info for a stored occupation value
 */
export const getOccupationCategory = (value) => {
  if (!value) return OCCUPATION_CATEGORIES.OTHER;
  for (const key of Object.keys(OCCUPATION_CATEGORIES)) {
    const cat = OCCUPATION_CATEGORIES[key];
    if (cat.occupations.some((o) => o.value === value)) {
      return cat;
    }
  }
  return OCCUPATION_CATEGORIES.OTHER;
};
