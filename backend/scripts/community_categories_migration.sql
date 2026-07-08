-- ============================================
-- COMMUNITY CATEGORIES MIGRATION
-- ============================================

CREATE TABLE IF NOT EXISTS community_categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'approved',  -- 'approved', 'pending', 'rejected'
  requested_by_community_id BIGINT,  -- NULL for admin-created categories
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_categories_active ON community_categories(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_community_categories_status ON community_categories(status);

-- Deactivate existing categories before updating active ones
UPDATE community_categories SET is_active = false;

-- Insert or reactivate community categories
INSERT INTO community_categories (name, display_order, status, is_active) VALUES
  -- Arts & Culture
  ('Music', 1, 'approved', true),
  ('Art & Culture', 2, 'approved', true),
  ('Movies', 3, 'approved', true),
  ('Books', 4, 'approved', true),
  ('Photography', 5, 'approved', true),
  ('Theatre & Drama', 6, 'approved', true),
  ('Poetry & Writing', 7, 'approved', true),
  ('Dance', 8, 'approved', true),
  ('Design & Architecture', 9, 'approved', true),
  ('Crafts & DIY', 10, 'approved', true),

  -- Fashion & Beauty
  ('Fashion & Style', 11, 'approved', true),
  ('Beauty & Skincare', 12, 'approved', true),
  ('Streetwear & Sneakers', 13, 'approved', true),
  ('Luxury & Design', 14, 'approved', true),
  ('Thrifting & Vintage', 15, 'approved', true),
  ('Modeling', 16, 'approved', true),

  -- Lifestyle
  ('Outdoors', 17, 'approved', true),
  ('Wellness & Mindfulness', 18, 'approved', true),
  ('Spirituality', 19, 'approved', true),
  ('Minimalism & Sustainable Living', 20, 'approved', true),

  -- Activity & Sports
  ('Sports', 21, 'approved', true),
  ('Fitness', 22, 'approved', true),
  ('Gaming', 23, 'approved', true),
  ('Running', 24, 'approved', true),
  ('Cycling', 25, 'approved', true),
  ('Yoga', 26, 'approved', true),
  ('Esports', 27, 'approved', true),
  ('Adventure Sports', 28, 'approved', true),
  ('Gym & Weightlifting', 29, 'approved', true),
  ('Bodybuilding', 30, 'approved', true),
  ('CrossFit & HIIT', 31, 'approved', true),
  ('Calisthenics', 32, 'approved', true),
  ('Martial Arts', 33, 'approved', true),
  ('Swimming', 34, 'approved', true),

  -- Professional & Tech
  ('Technology', 35, 'approved', true),
  ('Volunteering', 36, 'approved', true),
  ('Entrepreneurship & Startups', 37, 'approved', true),
  ('Finance & Investing', 38, 'approved', true),
  ('Marketing & Growth', 39, 'approved', true),
  ('Product & UX Design', 40, 'approved', true),
  ('Career Development', 41, 'approved', true),
  ('AI & Data Science', 42, 'approved', true),
  ('Consulting', 43, 'approved', true),
  ('Real Estate', 44, 'approved', true),
  ('Legal & Policy', 45, 'approved', true),

  -- Social & Meetups
  ('Casual Hangouts', 46, 'approved', true),
  ('Making Friends', 47, 'approved', true),
  ('Coffee Chats', 48, 'approved', true),
  ('Language Exchange', 49, 'approved', true),
  ('Newcomers & Relocation', 50, 'approved', true),
  ('Study & Co-working', 51, 'approved', true),
  ('Singles & Dating', 52, 'approved', true),
  ('Speed Friending', 53, 'approved', true),
  ('Expats & International Community', 54, 'approved', true),
  ('Neighborhood & Local Community', 55, 'approved', true),

  -- Academics & Learning
  ('College Life', 56, 'approved', true),
  ('Study Groups', 57, 'approved', true),
  ('Research & Academia', 58, 'approved', true),
  ('Competitive Exams', 59, 'approved', true),
  ('Skill Development', 60, 'approved', true),
  ('Public Speaking', 61, 'approved', true),
  ('Test Prep (GRE, GMAT, CAT)', 62, 'approved', true),
  ('Higher Education Abroad', 63, 'approved', true),

  -- Identity & Community
  ('Women''s Community', 64, 'approved', true),
  ('Men''s Community', 65, 'approved', true),
  ('LGBTQ+', 66, 'approved', true),
  ('Cultural & Regional Groups', 67, 'approved', true),
  ('Faith & Religion', 68, 'approved', true),
  ('Parents & Family', 69, 'approved', true),
  ('Alumni Networks', 70, 'approved', true),
  ('Differently-abled Community', 71, 'approved', true),
  ('Senior & 50+ Community', 72, 'approved', true),

  -- Entertainment & Fandom
  ('Anime & Comics', 73, 'approved', true),
  ('Board Games', 74, 'approved', true),
  ('TV & Streaming', 75, 'approved', true),
  ('Music Fandom', 76, 'approved', true),
  ('Sports Fandom', 77, 'approved', true),
  ('K-pop', 78, 'approved', true),
  ('Cosplay', 79, 'approved', true),
  ('Streaming & Content Creation', 80, 'approved', true),

  -- Causes & Impact
  ('Environment & Sustainability', 81, 'approved', true),
  ('Social Impact', 82, 'approved', true),
  ('Animal Welfare', 83, 'approved', true),
  ('Civic Engagement', 84, 'approved', true),
  ('Human Rights', 85, 'approved', true),
  ('Education Access', 86, 'approved', true),

  -- Automotive & Motorsports
  ('Car Enthusiasts', 87, 'approved', true),
  ('Bike & Motorcycle', 88, 'approved', true),
  ('Motorsport Fandom', 89, 'approved', true),
  ('EV & Sustainable Mobility', 90, 'approved', true),
  ('Road Trips & Rallies', 91, 'approved', true),
  ('Detailing & Modification', 92, 'approved', true),

  -- Food & Drink (New Group)
  ('Foodies & Restaurants', 93, 'approved', true),
  ('Home Cooking & Baking', 94, 'approved', true),
  ('Wine & Spirits', 95, 'approved', true),
  ('Coffee Culture', 96, 'approved', true),
  ('Vegan & Vegetarian', 97, 'approved', true),
  ('Food Blogging & Reviewing', 98, 'approved', true),

  -- Travel & Exploration (New Group)
  ('Backpacking', 99, 'approved', true),
  ('Solo Travel', 100, 'approved', true),
  ('Luxury Travel', 101, 'approved', true),
  ('Road Trips', 102, 'approved', true),
  ('Digital Nomads', 103, 'approved', true),
  ('Travel Photography', 104, 'approved', true),

  -- Pets & Animals (New Group)
  ('Dog Owners', 105, 'approved', true),
  ('Cat Lovers', 106, 'approved', true),
  ('Pet Adoption & Rescue', 107, 'approved', true),
  ('Exotic Pets', 108, 'approved', true),
  ('Pet Training', 109, 'approved', true),
  ('Pet-friendly Meetups', 110, 'approved', true),

  -- Health & Support (New Group)
  ('Mental Health Support', 111, 'approved', true),
  ('Chronic Illness Support', 112, 'approved', true),
  ('Nutrition & Diet', 113, 'approved', true),
  ('Sober & Recovery Community', 114, 'approved', true),
  ('New Parents Support', 115, 'approved', true)
ON CONFLICT (name) DO UPDATE SET is_active = true, display_order = EXCLUDED.display_order;
