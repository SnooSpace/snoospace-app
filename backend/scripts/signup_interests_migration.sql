-- Deactivate all old signup interests
UPDATE signup_interests SET is_active = false;

-- Insert or update the new interests
INSERT INTO signup_interests (label, icon_name, display_order, is_active, user_type) VALUES
-- Lifestyle
('Fashion', 'shirt', 1, true, 'all'),
('Volunteering', 'hand-heart', 2, true, 'all'),
('Dating', 'heart', 3, true, 'all'),
('Beauty & Skincare', 'sparkles', 4, true, 'all'),
('Minimalism & Sustainable Living', 'leaf', 5, true, 'all'),
('Home & Design', 'sofa', 6, true, 'all'),
('Spirituality', 'flame', 7, true, 'all'),

-- Sports & Fitness
('Sports', 'trophy', 8, true, 'all'),
('Fitness', 'dumbbell', 9, true, 'all'),
('Run Club', 'footprints', 10, true, 'all'),
('Badminton', 'activity', 11, true, 'all'),
('Basketball', 'activity', 12, true, 'all'),
('Football', 'activity', 13, true, 'all'),
('Cycling', 'bike', 14, true, 'all'),
('Yoga', 'flower', 15, true, 'all'),
('Gym & Weightlifting', 'dumbbell', 16, true, 'all'),
('Swimming', 'waves', 17, true, 'all'),
('Martial Arts', 'swords', 18, true, 'all'),

-- Arts & Culture
('Art & Culture', 'palette', 19, true, 'all'),
('Photography', 'camera', 20, true, 'all'),
('Theatre & Drama', 'drama', 21, true, 'all'),
('Poetry & Writing', 'pen-line', 22, true, 'all'),
('Dance', 'activity', 23, true, 'all'),
('Design & Architecture', 'layout-template', 24, true, 'all'),
('Crafts & DIY', 'hammer', 25, true, 'all'),

-- Entertainment
('Music', 'music', 26, true, 'all'),
('Movies', 'clapperboard', 27, true, 'all'),
('Books', 'book', 28, true, 'all'),
('TV & Streaming', 'tv', 29, true, 'all'),
('Anime & Comics', 'book-open', 30, true, 'all'),
('Board Games', 'dice-5', 31, true, 'all'),
('Stand-up Comedy', 'laugh', 32, true, 'all'),
('K-pop', 'music', 33, true, 'all'),

-- Food & Drink
('Food & Drink', 'utensils-crossed', 34, true, 'all'),
('Bar Hopping', 'martini', 35, true, 'all'),
('Cafe Hopping', 'coffee', 36, true, 'all'),
('Foodie', 'utensils-crossed', 37, true, 'all'),
('Drinks', 'wine', 38, true, 'all'),
('Home Cooking & Baking', 'chef-hat', 39, true, 'all'),
('Vegan & Vegetarian', 'leaf', 40, true, 'all'),

-- Outdoors & Adventure
('Travel', 'plane', 41, true, 'all'),
('Adventure', 'mountain-snow', 42, true, 'all'),
('Camping', 'tent', 43, true, 'all'),
('Hiking & Trekking', 'mountain', 44, true, 'all'),
('Backpacking', 'backpack', 45, true, 'all'),
('Road Trips', 'car', 46, true, 'all'),
('Beach & Water Sports', 'waves', 47, true, 'all'),

-- Tech & Gaming
('Technology', 'code', 48, true, 'all'),
('Gaming', 'gamepad-2', 49, true, 'all'),
('Esports', 'monitor', 50, true, 'all'),
('AI & Data Science', 'brain-circuit', 51, true, 'all'),
('Startups & Entrepreneurship', 'rocket', 52, true, 'all'),
('VR & AR', 'glasses', 53, true, 'all'),

-- Social
('Networking', 'users', 54, true, 'all'),
('Making Friends', 'handshake', 55, true, 'all'),
('Coffee Chats', 'coffee', 56, true, 'all'),
('Public Speaking', 'mic', 57, true, 'all'),
('Language Exchange', 'languages', 58, true, 'all'),
('Speed Friending', 'shuffle', 59, true, 'all'),

-- Automotive
('Cars', 'car', 60, true, 'all'),
('Bikes', 'bike', 61, true, 'all'),
('Motorsport Fandom', 'flag', 62, true, 'all'),
('EV & Sustainable Mobility', 'zap', 63, true, 'all'),

-- Pets & Animals
('Dog Owner', 'paw-print', 64, true, 'all'),
('Cat Owner', 'paw-print', 65, true, 'all'),
('Pet Adoption & Rescue', 'heart', 66, true, 'all')
ON CONFLICT (label) DO UPDATE SET
  icon_name = EXCLUDED.icon_name,
  display_order = EXCLUDED.display_order,
  is_active = true;
