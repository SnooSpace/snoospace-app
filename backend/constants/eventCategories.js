/**
 * Main Event Categories and Hierarchy for SnooSpace Explore & Discovery
 * Source of truth mapped to EVENT_CATEGORIES_HIERARCHY
 */
const MAIN_EVENT_CATEGORIES = [
  {
    name: "Music",
    slug: "music",
    iconName: "music",
    subcategories: [
      "Music Events", "Live Concerts", "Open Mic Nights", "DJ Nights",
      "EDM & Electronic", "Indie & Alternative", "Classical & Fusion",
      "Karaoke Nights", "Battle of Bands"
    ]
  },
  {
    name: "Food & Dining",
    slug: "food-dining",
    iconName: "utensils-crossed",
    subcategories: [
      "Food & Dining", "Food Festivals", "Wine & Spirits Tasting",
      "Coffee & Cafe Meetups", "Cooking Classes", "Pop-up Restaurants",
      "Street Food Walks", "Brunches & Potlucks"
    ]
  },
  {
    name: "Sports & Fitness",
    slug: "sports-fitness",
    iconName: "heart-pulse",
    subcategories: [
      "Sports & Fitness", "Run Clubs", "Cycling Groups", "Yoga & Meditation",
      "CrossFit & HIIT", "Football & Cricket Meetups", "Adventure Sports",
      "Swimming & Water Sports", "Marathons & Fitness Challenges"
    ]
  },
  {
    name: "Tech & Startup",
    slug: "tech-startup",
    iconName: "code",
    subcategories: [
      "Tech & Networking", "Hackathons", "Startup Meetups", "AI & ML Meetups",
      "Web3 & Blockchain", "Product & Design Meetups", "Developer Conferences",
      "Women in Tech"
    ]
  },
  {
    name: "Gaming & Esports",
    slug: "gaming-esports",
    iconName: "gamepad-2",
    subcategories: [
      "Gaming", "LAN Parties", "Esports Tournaments", "Board Game Nights",
      "Tabletop RPG", "VR & AR Experiences", "Mobile Gaming Meetups"
    ]
  },
  {
    name: "Outdoors & Adventure",
    slug: "outdoors-adventure",
    iconName: "tent",
    subcategories: [
      "Outdoor Adventures", "Hiking & Trekking", "Camping", "Road Trips",
      "Nature Walks", "Rock Climbing", "Cycling Expeditions"
    ]
  },
  {
    name: "Arts & Culture",
    slug: "arts-culture",
    iconName: "palette",
    subcategories: [
      "Art & Culture", "Art Exhibitions", "Poetry & Spoken Word",
      "Dance Performances", "Theatre & Drama", "Photography Walks",
      "Craft & DIY Workshops", "Museum Tours"
    ]
  },
  {
    name: "Education & Workshops",
    slug: "education-workshops",
    iconName: "graduation-cap",
    subcategories: [
      "Workshops & Learning", "Skill-building Workshops", "Language Exchange",
      "Book Clubs", "Public Speaking & Toastmasters", "Finance & Investing Talks"
    ]
  },
  {
    name: "Nightlife & Parties",
    slug: "nightlife-parties",
    iconName: "martini",
    subcategories: [
      "Nightlife & Parties", "Club Nights", "House Parties", "Rooftop Parties",
      "Themed Costume Parties", "Silent Discos", "Pool Parties", "Beach Parties"
    ]
  },
  {
    name: "Wellness & Mindfulness",
    slug: "wellness-mindfulness",
    iconName: "heart-handshake",
    subcategories: [
      "Wellness & Mindfulness", "Meditation Retreats", "Sound Healing",
      "Mental Health Support Circles", "Spa & Self-care Days"
    ]
  },
  {
    name: "Networking & Career",
    slug: "networking-professional",
    iconName: "briefcase",
    subcategories: [
      "Networking Mixers", "Career Fairs", "Industry Conferences",
      "Panel Discussions", "Alumni Meetups", "Freelancer Meetups"
    ]
  },
  {
    name: "Comedy & Entertainment",
    slug: "comedy-entertainment",
    iconName: "laugh",
    subcategories: [
      "Comedy Shows", "Stand-up Open Mics", "Improv Nights",
      "Trivia Nights", "Magic Shows"
    ]
  },
  {
    name: "Family & Kids",
    slug: "family-kids",
    iconName: "baby",
    subcategories: [
      "Family & Kids Events", "Parenting Meetups", "Kids' Workshops",
      "Family Picnics", "School Events", "Summer Camps",
      "Story-time & Reading Sessions"
    ]
  },
  {
    name: "Seasonal & Holiday",
    slug: "seasonal-holiday",
    iconName: "sparkles",
    subcategories: [
      "Christmas Parties", "New Year Parties", "Diwali Celebrations",
      "Holi Celebrations", "Halloween Parties", "Valentine's Day Events",
      "Onam Celebrations", "Ganesh Chaturthi", "Eid Celebrations",
      "Navratri & Garba Nights", "Christmas Markets", "Summer Festivals",
      "Pongal & Sankranti", "Durga Puja", "Baisakhi", "Ugadi & Gudi Padwa",
      "Ramzan & Iftar Gatherings"
    ]
  }
];

module.exports = {
  MAIN_EVENT_CATEGORIES
};
