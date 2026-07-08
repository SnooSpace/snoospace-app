-- ============================================
-- DISCOVER CATEGORIES MIGRATION
-- ============================================

CREATE TABLE IF NOT EXISTS discover_categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,           -- "Christmas Parties", "New Year Events"
  slug TEXT NOT NULL UNIQUE,           -- "christmas-parties" (URL-friendly)
  icon_name TEXT,                      -- Ionicons or Lucide name for display
  description TEXT,
  display_order INTEGER DEFAULT 0,     -- Admin-controlled order
  is_active BOOLEAN DEFAULT true,
  visible_from TIMESTAMPTZ,            -- Scheduled visibility start
  visible_until TIMESTAMPTZ,           -- Scheduled visibility end
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discover_categories_active ON discover_categories(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_discover_categories_visibility ON discover_categories(visible_from, visible_until);

-- Deactivate existing categories before updating active ones
UPDATE discover_categories SET is_active = false;

-- Insert or reactivate discover categories
INSERT INTO discover_categories (name, slug, icon_name, display_order, is_active) VALUES
  -- Seasonal & Holiday
  ('Christmas Parties', 'christmas-parties', 'gift', 1, true),
  ('New Year Parties', 'new-year-parties', 'sparkles', 2, true),
  ('Diwali Celebrations', 'diwali-celebrations', 'flame', 3, true),
  ('Holi Celebrations', 'holi-celebrations', 'droplets', 4, true),
  ('Halloween Parties', 'halloween-parties', 'ghost', 5, true),
  ('Valentine''s Day Events', 'valentines-day-events', 'heart', 6, true),
  ('Onam Celebrations', 'onam-celebrations', 'flower-2', 7, true),
  ('Ganesh Chaturthi', 'ganesh-chaturthi', 'landmark', 8, true),
  ('Eid Celebrations', 'eid-celebrations', 'moon-star', 9, true),
  ('Navratri & Garba Nights', 'navratri-garba-nights', 'disc-3', 10, true),
  ('Christmas Markets', 'christmas-markets', 'shopping-bag', 11, true),
  ('Summer Festivals', 'summer-festivals', 'sun', 12, true),
  ('Pongal & Sankranti', 'pongal-sankranti', 'sun', 13, true),
  ('Durga Puja', 'durga-puja', 'flame', 14, true),
  ('Baisakhi', 'baisakhi', 'wheat', 15, true),
  ('Ugadi & Gudi Padwa', 'ugadi-gudi-padwa', 'flower-2', 16, true),
  ('Ramzan & Iftar Gatherings', 'ramzan-iftar-gatherings', 'moon-star', 17, true),

  -- Music
  ('Music Events', 'music-events', 'music', 18, true),
  ('Live Concerts', 'live-concerts', 'mic-2', 19, true),
  ('Open Mic Nights', 'open-mic-nights', 'mic', 20, true),
  ('DJ Nights', 'dj-nights', 'disc', 21, true),
  ('EDM & Electronic', 'edm-electronic', 'waves', 22, true),
  ('Indie & Alternative', 'indie-alternative', 'guitar', 23, true),
  ('Classical & Fusion', 'classical-fusion', 'music-4', 24, true),
  ('Karaoke Nights', 'karaoke-nights', 'mic-vocal', 25, true),
  ('Battle of Bands', 'battle-of-bands', 'swords', 26, true),

  -- Food & Dining
  ('Food & Dining', 'food-dining', 'utensils-crossed', 27, true),
  ('Food Festivals', 'food-festivals', 'soup', 28, true),
  ('Wine & Spirits Tasting', 'wine-spirits-tasting', 'wine', 29, true),
  ('Coffee & Cafe Meetups', 'coffee-cafe-meetups', 'coffee', 30, true),
  ('Cooking Classes', 'cooking-classes', 'chef-hat', 31, true),
  ('Pop-up Restaurants', 'pop-up-restaurants', 'store', 32, true),
  ('Street Food Walks', 'street-food-walks', 'cookie', 33, true),
  ('Brunches & Potlucks', 'brunches-potlucks', 'sandwich', 34, true),

  -- Sports & Fitness
  ('Sports & Fitness', 'sports-fitness', 'heart-pulse', 35, true),
  ('Run Clubs', 'run-clubs', 'footprints', 36, true),
  ('Cycling Groups', 'cycling-groups', 'bike', 37, true),
  ('Yoga & Meditation', 'yoga-meditation', 'flower', 38, true),
  ('CrossFit & HIIT', 'crossfit-hiit', 'dumbbell', 39, true),
  ('Football & Cricket Meetups', 'football-cricket-meetups', 'trophy', 40, true),
  ('Adventure Sports', 'adventure-sports', 'mountain-snow', 41, true),
  ('Swimming & Water Sports', 'swimming-water-sports', 'waves', 42, true),
  ('Marathons & Fitness Challenges', 'marathons-fitness-challenges', 'medal', 43, true),

  -- Tech & Startup
  ('Tech & Networking', 'tech-networking', 'code', 44, true),
  ('Hackathons', 'hackathons', 'terminal', 45, true),
  ('Startup Meetups', 'startup-meetups', 'rocket', 46, true),
  ('AI & ML Meetups', 'ai-ml-meetups', 'brain-circuit', 47, true),
  ('Web3 & Blockchain', 'web3-blockchain', 'link', 48, true),
  ('Product & Design Meetups', 'product-design-meetups', 'pen-tool', 49, true),
  ('Developer Conferences', 'developer-conferences', 'laptop', 50, true),
  ('Women in Tech', 'women-in-tech', 'users', 51, true),

  -- Gaming & Esports
  ('Gaming', 'gaming', 'gamepad-2', 52, true),
  ('LAN Parties', 'lan-parties', 'server', 53, true),
  ('Esports Tournaments', 'esports-tournaments', 'trophy', 54, true),
  ('Board Game Nights', 'board-game-nights', 'dice-5', 55, true),
  ('Tabletop RPG', 'tabletop-rpg', 'swords', 56, true),
  ('VR & AR Experiences', 'vr-ar-experiences', 'glasses', 57, true),
  ('Mobile Gaming Meetups', 'mobile-gaming-meetups', 'smartphone', 58, true),

  -- Outdoors & Adventure
  ('Outdoor Adventures', 'outdoor-adventures', 'tent', 59, true),
  ('Hiking & Trekking', 'hiking-trekking', 'mountain', 60, true),
  ('Camping', 'camping', 'tent', 61, true),
  ('Road Trips', 'road-trips', 'car', 62, true),
  ('Nature Walks', 'nature-walks', 'trees', 63, true),
  ('Rock Climbing', 'rock-climbing', 'mountain-snow', 64, true),
  ('Cycling Expeditions', 'cycling-expeditions', 'bike', 65, true),

  -- Arts & Culture
  ('Art & Culture', 'art-culture', 'palette', 66, true),
  ('Art Exhibitions', 'art-exhibitions', 'image', 67, true),
  ('Poetry & Spoken Word', 'poetry-spoken-word', 'book-open', 68, true),
  ('Dance Performances', 'dance-performances', 'activity', 69, true),
  ('Theatre & Drama', 'theatre-drama', 'clapperboard', 70, true),
  ('Photography Walks', 'photography-walks', 'camera', 71, true),
  ('Craft & DIY Workshops', 'craft-diy-workshops', 'scissors', 72, true),
  ('Museum Tours', 'museum-tours', 'landmark', 73, true),

  -- Education & Workshops
  ('Workshops & Learning', 'workshops-learning', 'graduation-cap', 74, true),
  ('Skill-building Workshops', 'skill-building-workshops', 'wrench', 75, true),
  ('Language Exchange', 'language-exchange', 'languages', 76, true),
  ('Book Clubs', 'book-clubs', 'book', 77, true),
  ('Public Speaking & Toastmasters', 'public-speaking-toastmasters', 'mic', 78, true),
  ('Finance & Investing Talks', 'finance-investing-talks', 'line-chart', 79, true),

  -- Nightlife & Parties
  ('Nightlife & Parties', 'nightlife-parties', 'martini', 80, true),
  ('Club Nights', 'club-nights', 'disc', 81, true),
  ('House Parties', 'house-parties', 'home', 82, true),
  ('Rooftop Parties', 'rooftop-parties', 'building', 83, true),
  ('Themed Costume Parties', 'themed-costume-parties', 'drama', 84, true),
  ('Silent Discos', 'silent-discos', 'headphones', 85, true),
  ('Pool Parties', 'pool-parties', 'waves', 86, true),
  ('Beach Parties', 'beach-parties', 'sun', 87, true),

  -- Wellness & Mindfulness
  ('Wellness & Mindfulness', 'wellness-mindfulness', 'heart-handshake', 88, true),
  ('Meditation Retreats', 'meditation-retreats', 'flower', 89, true),
  ('Sound Healing', 'sound-healing', 'waves', 90, true),
  ('Mental Health Support Circles', 'mental-health-support-circles', 'hand-heart', 91, true),
  ('Spa & Self-care Days', 'spa-self-care-days', 'sparkles', 92, true),

  -- Networking & Professional
  ('Networking Mixers', 'networking-mixers', 'users', 93, true),
  ('Career Fairs', 'career-fairs', 'briefcase', 94, true),
  ('Industry Conferences', 'industry-conferences', 'presentation', 95, true),
  ('Panel Discussions', 'panel-discussions', 'mic', 96, true),
  ('Alumni Meetups', 'alumni-meetups', 'school', 97, true),
  ('Freelancer Meetups', 'freelancer-meetups', 'laptop', 98, true),

  -- Community & Social Causes
  ('Volunteering & Charity', 'volunteering-charity', 'hand-heart', 99, true),
  ('Environmental Clean-ups', 'environmental-clean-ups', 'leaf', 100, true),
  ('Fundraisers', 'fundraisers', 'piggy-bank', 101, true),
  ('Blood Donation Drives', 'blood-donation-drives', 'droplet', 102, true),
  ('Awareness Campaigns', 'awareness-campaigns', 'megaphone', 103, true),
  ('Community Service', 'community-service', 'users', 104, true),

  -- Family & Kids
  ('Family & Kids Events', 'family-kids-events', 'baby', 105, true),
  ('Parenting Meetups', 'parenting-meetups', 'users', 106, true),
  ('Kids'' Workshops', 'kids-workshops', 'puzzle', 107, true),
  ('Family Picnics', 'family-picnics', 'sandwich', 108, true),
  ('School Events', 'school-events', 'school', 109, true),
  ('Summer Camps', 'summer-camps', 'tent', 110, true),
  ('Story-time & Reading Sessions', 'story-time-reading-sessions', 'book-open', 111, true),

  -- Hobbies & Clubs
  ('Photography Clubs', 'photography-clubs', 'camera', 112, true),
  ('Chess Clubs', 'chess-clubs', 'crown', 113, true),
  ('Gardening Meetups', 'gardening-meetups', 'sprout', 114, true),
  ('Pottery & Crafts', 'pottery-crafts', 'hammer', 115, true),
  ('Knitting & Sewing Circles', 'knitting-sewing-circles', 'scissors', 116, true),
  ('Astronomy & Stargazing', 'astronomy-stargazing', 'telescope', 117, true),

  -- Comedy & Entertainment
  ('Comedy Shows', 'comedy-shows', 'laugh', 118, true),
  ('Stand-up Open Mics', 'stand-up-open-mics', 'mic', 119, true),
  ('Improv Nights', 'improv-nights', 'drama', 120, true),
  ('Trivia Nights', 'trivia-nights', 'brain', 121, true),
  ('Magic Shows', 'magic-shows', 'wand-2', 122, true),

  -- Film & Media
  ('Film Screenings', 'film-screenings', 'clapperboard', 123, true),
  ('Film Festivals', 'film-festivals', 'film', 124, true),
  ('Podcast Recordings & Live Shows', 'podcast-recordings-live-shows', 'podcast', 125, true),
  ('Content Creator Meetups', 'content-creator-meetups', 'video', 126, true),

  -- Fashion & Lifestyle
  ('Fashion Shows', 'fashion-shows', 'shirt', 127, true),
  ('Styling Workshops', 'styling-workshops', 'scissors', 128, true),
  ('Beauty Pop-ups', 'beauty-pop-ups', 'sparkles', 129, true),
  ('Thrift & Swap Meets', 'thrift-swap-meets', 'shopping-bag', 130, true),

  -- Travel & Exploration
  ('Travel Meetups', 'travel-meetups', 'plane', 131, true),
  ('Backpacking Groups', 'backpacking-groups', 'backpack', 132, true),
  ('City Exploration Walks', 'city-exploration-walks', 'map', 133, true),
  ('Weekend Getaways', 'weekend-getaways', 'compass', 134, true),

  -- Religious & Spiritual
  ('Religious Gatherings', 'religious-gatherings', 'church', 135, true),
  ('Satsangs', 'satsangs', 'flame', 136, true),
  ('Spiritual Retreats', 'spiritual-retreats', 'mountain', 137, true),
  ('Interfaith Dialogues', 'interfaith-dialogues', 'users', 138, true),

  -- College & Campus
  ('College Fests', 'college-fests', 'school', 139, true),
  ('Campus Hackathons', 'campus-hackathons', 'terminal', 140, true),
  ('Freshers'' Parties', 'freshers-parties', 'party-popper', 141, true),
  ('Farewell Parties', 'farewell-parties', 'heart', 142, true),
  ('Cultural Fests', 'cultural-fests', 'drama', 143, true),

  -- Pets & Animals
  ('Pet Meetups', 'pet-meetups', 'paw-print', 144, true),
  ('Dog Park Meetups', 'dog-park-meetups', 'footprints', 145, true),
  ('Dog Walking Groups', 'dog-walking-groups', 'footprints', 146, true),
  ('Cat Meetups', 'cat-meetups', 'paw-print', 147, true),
  ('Pet Adoption Drives', 'pet-adoption-drives', 'heart', 148, true),
  ('Pet-friendly Cafes & Events', 'pet-friendly-cafes-events', 'coffee', 149, true),
  ('Pet Training Workshops', 'pet-training-workshops', 'graduation-cap', 150, true),
  ('Animal Shelter Volunteering', 'animal-shelter-volunteering', 'hand-heart', 151, true),
  ('Pet Shows & Expos', 'pet-shows-expos', 'trophy', 152, true),

  -- Automotive & Motorsports
  ('Car Meetups', 'car-meetups', 'car', 153, true),
  ('Bike Rallies', 'bike-rallies', 'bike', 154, true),
  ('Motorsport Watch Parties', 'motorsport-watch-parties', 'flag', 155, true),

  -- Markets & Pop-ups
  ('Flea Markets', 'flea-markets', 'shopping-bag', 156, true),
  ('Night Markets', 'night-markets', 'moon', 157, true),
  ('Artisan Pop-ups', 'artisan-pop-ups', 'store', 158, true),
  ('Farmers Markets', 'farmers-markets', 'carrot', 159, true),

  -- Casual Meetups & Making Friends
  ('Casual Hangouts', 'casual-hangouts', 'users', 160, true),
  ('Coffee Chats & 1:1 Meetups', 'coffee-chats-1-1-meetups', 'coffee', 161, true),
  ('Speed Friending', 'speed-friending', 'shuffle', 162, true),
  ('Singles Mixers', 'singles-mixers', 'heart', 163, true),
  ('Speed Dating', 'speed-dating', 'clock', 164, true),
  ('Blind Date Events', 'blind-date-events', 'eye-off', 165, true),
  ('Newcomer & Relocation Meetups', 'newcomer-relocation-meetups', 'map-pin', 166, true),
  ('Study & Co-working Sessions', 'study-co-working-sessions', 'book-open-check', 167, true),
  ('Icebreaker Socials', 'icebreaker-socials', 'snowflake', 168, true),

  -- Celebrations & Milestones (New Group)
  ('Birthday Parties', 'birthday-parties', 'gift', 169, true),
  ('Anniversary Celebrations', 'anniversary-celebrations', 'heart', 170, true),
  ('Baby Showers', 'baby-showers', 'baby', 171, true),
  ('Engagement Parties', 'engagement-parties', 'gem', 172, true),
  ('Bachelor & Bachelorette Parties', 'bachelor-bachelorette-parties', 'party-popper', 173, true),
  ('Retirement Parties', 'retirement-parties', 'briefcase', 174, true),
  ('Reunions', 'reunions', 'users', 175, true),

  -- Business & Corporate (New Group)
  ('Product Launches', 'product-launches', 'rocket', 176, true),
  ('Trade Shows & Expos', 'trade-shows-expos', 'store', 177, true),
  ('Corporate Team Outings', 'corporate-team-outings', 'users', 178, true),
  ('Corporate Training', 'corporate-training', 'graduation-cap', 179, true),
  ('Award Ceremonies', 'award-ceremonies', 'trophy', 180, true)
ON CONFLICT (name) DO UPDATE SET is_active = true, display_order = EXCLUDED.display_order, slug = EXCLUDED.slug, icon_name = EXCLUDED.icon_name;
