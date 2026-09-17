const CATEGORY_COLORS = {
  'music': { bg: '#CECBF6', text: '#26215C' },
  'music-events': { bg: '#CECBF6', text: '#26215C' },
  'networking': { bg: '#B5D4F4', text: '#042C53' },
  'networking-professional': { bg: '#B5D4F4', text: '#042C53' },
  'tech-networking': { bg: '#B5D4F4', text: '#042C53' },
  'tech-startup': { bg: '#C2E7FF', text: '#003355' },
  'food-dining': { bg: '#FFE8D6', text: '#6D2B05' },
  'sports-fitness': { bg: '#D3F5E4', text: '#0D472B' },
  'outdoors-adventure': { bg: '#D1EAD4', text: '#14431B' },
  'arts-culture': { bg: '#F9D8E6', text: '#581134' },
  'gaming-esports': { bg: '#E8DDFF', text: '#311465' },
  'nightlife-parties': { bg: '#E4D4F8', text: '#3B1768' },
  'wellness-mindfulness': { bg: '#D2F2EF', text: '#00473E' },
  'comedy-entertainment': { bg: '#FFF0C2', text: '#5C4300' },
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
