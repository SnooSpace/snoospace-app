'use strict';

/**
 * reviewTags.js — Single source of truth for all review tag keys.
 *
 * Tag sets per worth_it_rating branch:
 *   Positive branch: 'absolutely' | 'mostly'
 *   Neutral branch:  'okay'
 *   Negative branch: 'not_really' | 'not_at_all'
 *
 * IMPORTANT: The literal string 'safety_concerns' MUST match exactly
 * in this file AND in the controller's safety check (reviewController.js).
 * Drift between these two is a silent bug — the controller imports
 * SAFETY_CONCERNS_TAG from this module to guarantee they stay in sync.
 */

// safety_concerns is valid across ALL branches — triggered by the tag regardless of sentiment
const SAFETY_CONCERNS_TAG_ENTRY = 'safety_concerns';

const POSITIVE_TAGS = [
  'great_people',
  'great_speakers',
  'well_organized',
  'good_venue',
  'fun_activities',
  'learned_something_new',
  'valuable_connections',
  'good_food',
  'great_atmosphere',
  'good_value',
  'safety_concerns',  // valid on any branch per spec
];

const NEUTRAL_TAGS = [
  'organization',
  'venue',
  'crowd',
  'schedule',
  'networking',
  'activities',
  'food',
  'communication',
  'value',
  'safety_concerns',  // valid on any branch per spec
];
const NEGATIVE_TAGS = [
  'poor_organization',
  'not_as_advertised',
  'bad_crowd',
  'too_crowded',
  'venue_issues',
  'long_wait',
  'didnt_meet_anyone',
  'safety_concerns',  // ← triggers required comment + moderation routing
  'other',
];

/** The canonical safety tag key. Imported by controller — do not duplicate. */
const SAFETY_CONCERNS_TAG = 'safety_concerns';

/** All valid tag keys across all branches (for server-side validation). */
const ALL_VALID_TAGS = [...new Set([...POSITIVE_TAGS, ...NEUTRAL_TAGS, ...NEGATIVE_TAGS])];

/**
 * Returns the valid tag set for a given worth_it_rating value.
 * Positive branches (absolutely/mostly) and negative branches (not_really/not_at_all)
 * share the same tag set respectively — same friction, same required-min-1 rule.
 */
function getTagsForRating(worthItRating) {
  switch (worthItRating) {
    case 'absolutely':
    case 'mostly':
      return POSITIVE_TAGS;
    case 'okay':
      return NEUTRAL_TAGS;
    case 'not_really':
    case 'not_at_all':
      return NEGATIVE_TAGS;
    default:
      return ALL_VALID_TAGS;
  }
}

module.exports = {
  POSITIVE_TAGS,
  NEUTRAL_TAGS,
  NEGATIVE_TAGS,
  SAFETY_CONCERNS_TAG,
  ALL_VALID_TAGS,
  getTagsForRating,
};
