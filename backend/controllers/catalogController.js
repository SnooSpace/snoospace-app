async function getInterests(req, res) {
  try {
    const pool = req.app.locals.pool;
    
    const interests = [
      'Technology', 'Sports', 'Music', 'Art', 'Travel', 'Food', 'Fitness', 'Gaming',
      'Reading', 'Photography', 'Movies', 'Dancing', 'Cooking', 'Fashion', 'Nature',
      'Science', 'History', 'Business', 'Education', 'Volunteering', 'Yoga', 'Meditation',
      'Crafting', 'Writing', 'Comedy', 'Theater', 'Comics', 'Anime', 'Cars', 'Pets',
      'Social Causes', 'Politics', 'Environment', 'Entrepreneurship', 'Startups',
      'Web Development', 'Mobile Development', 'Data Science', 'AI/ML', 'Design',
      'Marketing', 'Sales', 'Finance', 'Real Estate', 'Healthcare', 'Law', 'Engineering'
    ];

    res.json({ interests });
  } catch (err) {
    console.error("/catalog/interests error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Failed to fetch interests" });
  }
}

module.exports = { getInterests };

