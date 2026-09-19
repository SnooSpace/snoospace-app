/**
 * disruptionReasons.js
 *
 * Frontend options for host event cancellation and postponement reasons.
 * Note: Genuine vs non-genuine classification is intentionally not exposed to hosts.
 */

export const DISRUPTION_REASON_OPTIONS = [
  { id: 'venue_unavailable', label: 'Venue Unavailable' },
  { id: 'personal_emergency', label: 'Personal / Host Emergency' },
  { id: 'weather_safety', label: 'Severe Weather or Safety Issue' },
  { id: 'scheduling_conflict', label: 'Scheduling Conflict' },
  { id: 'change_of_plans', label: 'Change of Plans' },
  { id: 'no_longer_available', label: 'Organizer No Longer Available' },
  { id: 'other', label: 'Other (Please specify)' },
];
