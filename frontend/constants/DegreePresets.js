/**
 * DegreePresets.js
 *
 * Categorised degree/major suggestions used in the Degree / Major autocomplete
 * picker across the Edit Profile and Signup flows.
 *
 * Each category has:
 *   label  — display name shown as a section header
 *   items  — string list of degree strings
 */

export const DEGREE_CATEGORIES = [
  {
    label: "Engineering & Tech",
    items: [
      "B.Tech Computer Science",
      "B.Tech Information Technology",
      "B.Tech Electronics & Communication",
      "B.Tech Mechanical Engineering",
      "B.Tech Civil Engineering",
      "B.Tech Electrical Engineering",
      "M.Tech Computer Science",
      "B.E. Computer Science",
    ],
  },
  {
    label: "Business & Management",
    items: [
      "BBA Business Administration",
      "MBA Marketing",
      "MBA Finance",
      "B.Com Accounting & Finance",
      "BMS Business Management",
    ],
  },
  {
    label: "Science",
    items: [
      "B.Sc Computer Science",
      "B.Sc Physics",
      "B.Sc Chemistry",
      "B.Sc Mathematics",
      "M.Sc Data Science",
    ],
  },
  {
    label: "Healthcare & Medicine",
    items: [
      "MBBS Medicine",
      "BDS Dentistry",
      "B.Pharm Pharmacy",
      "BSc Nursing",
      "BPT Physiotherapy",
    ],
  },
  {
    label: "Creative & Media",
    items: [
      "BDes Visual Communication",
      "BFA Fine Arts",
      "B.Sc Animation & VFX",
      "BA Journalism & Mass Communication",
      "BDes UI/UX Design",
    ],
  },
  {
    label: "Arts & Humanities",
    items: [
      "BA Psychology",
      "BA Economics",
      "BA English Literature",
      "BA Political Science",
    ],
  },
];

/**
 * Flat list of all degree strings for easy searching.
 */
export const ALL_DEGREES = DEGREE_CATEGORIES.flatMap((cat) => cat.items);
