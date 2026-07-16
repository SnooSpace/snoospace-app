/**
 * reviewTags.js — Frontend review tag constants.
 * Mirror of backend/constants/reviewTags.js — must stay in sync.
 *
 * IMPORTANT: The string 'safety_concerns' must be identical in:
 *   - This file (SAFETY_CONCERNS_TAG)
 *   - backend/constants/reviewTags.js
 *   - backend/controllers/reviewController.js
 * Any drift is a silent bug.
 */

// The safety_concerns entry is appended to EVERY tag branch per spec:
// "safety_concerns (available regardless of which worth_it_rating was picked)"
const SAFETY_CONCERNS_ENTRY = { key: 'safety_concerns', label: 'Safety concerns' };

export const POSITIVE_TAGS = [
  { key: 'great_people',          label: 'Great people' },
  { key: 'great_speakers',        label: 'Great speakers' },
  { key: 'well_organized',        label: 'Well organized' },
  { key: 'good_venue',            label: 'Good venue' },
  { key: 'fun_activities',        label: 'Fun activities' },
  { key: 'learned_something_new', label: 'Learned something new' },
  { key: 'valuable_connections',  label: 'Valuable connections' },
  { key: 'good_food',             label: 'Good food' },
  { key: 'great_atmosphere',      label: 'Great atmosphere' },
  { key: 'good_value',            label: 'Good value' },
  SAFETY_CONCERNS_ENTRY,           // always last — visually separate
];

export const NEUTRAL_TAGS = [
  { key: 'organization',  label: 'Organization' },
  { key: 'venue',         label: 'Venue' },
  { key: 'crowd',         label: 'Crowd' },
  { key: 'schedule',      label: 'Schedule' },
  { key: 'networking',    label: 'Networking' },
  { key: 'activities',    label: 'Activities' },
  { key: 'food',          label: 'Food' },
  { key: 'communication', label: 'Communication' },
  { key: 'value',         label: 'Value' },
  SAFETY_CONCERNS_ENTRY,           // always last — visually separate
];

export const NEGATIVE_TAGS = [
  { key: 'poor_organization',  label: 'Poor organization' },
  { key: 'not_as_advertised',  label: 'Not as advertised' },
  { key: 'bad_crowd',          label: 'Bad crowd' },
  { key: 'too_crowded',        label: 'Too crowded' },
  { key: 'venue_issues',       label: 'Venue issues' },
  { key: 'long_wait',          label: 'Long wait' },
  { key: 'didnt_meet_anyone',  label: "Didn't meet anyone" },
  { key: 'safety_concerns',    label: 'Safety concerns' }, // ← triggers required comment
  { key: 'other',              label: 'Other' },
];

/** Canonical safety tag key — used in both tag list and safety-comment-required check */
export const SAFETY_CONCERNS_TAG = 'safety_concerns';

/**
 * Returns the valid tag set for a given worth_it_rating value.
 * Per spec: safety_concerns is appended to EVERY branch — it appears regardless
 * of which worth_it_rating was selected.
 */
export function getTagsForRating(worthItRating) {
  switch (worthItRating) {
    case 'absolutely':
    case 'mostly':
      return POSITIVE_TAGS;  // includes SAFETY_CONCERNS_ENTRY at end
    case 'okay':
      return NEUTRAL_TAGS;   // includes SAFETY_CONCERNS_ENTRY at end
    case 'not_really':
    case 'not_at_all':
      return NEGATIVE_TAGS;  // already includes safety_concerns in its natural position
    default:
      return POSITIVE_TAGS;
  }
}
