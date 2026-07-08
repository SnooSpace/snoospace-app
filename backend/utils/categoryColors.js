const CATEGORY_COLORS = {
  'music': { bg: '#CECBF6', text: '#26215C' },
  'music-events': { bg: '#CECBF6', text: '#26215C' },
  'networking': { bg: '#B5D4F4', text: '#042C53' },
  'tech-networking': { bg: '#B5D4F4', text: '#042C53' },
  'weekend': { bg: '#9FE1CB', text: '#04342C' },
  'serendipity': { bg: '#F5C4B3', text: '#4A1B0C' },
  'different': { bg: '#F5C4B3', text: '#4A1B0C' }
};

const DEFAULT_COLORS = [
  { bg: '#CECBF6', text: '#26215C' },
  { bg: '#B5D4F4', text: '#042C53' },
  { bg: '#9FE1CB', text: '#04342C' },
  { bg: '#F5C4B3', text: '#4A1B0C' }
];

function getCategoryColor(slug, id) {
  const cleanSlug = String(slug || '').toLowerCase().trim();
  if (CATEGORY_COLORS[cleanSlug]) {
    return CATEGORY_COLORS[cleanSlug];
  }
  const index = (id || 0) % DEFAULT_COLORS.length;
  return DEFAULT_COLORS[index];
}

module.exports = { CATEGORY_COLORS, getCategoryColor };
