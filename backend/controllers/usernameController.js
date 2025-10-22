const { createPool } = require("../config/db");

const pool = createPool();

// Check username availability across all user types
const checkUsername = async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }

    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_.]{3,30}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({ 
        error: "Username must be 3-30 characters long and contain only letters, numbers, underscores, and dots" 
      });
    }

    // Check availability across all tables
    const queries = [
      pool.query("SELECT id FROM members WHERE username = $1", [username]),
      pool.query("SELECT id FROM communities WHERE username = $1", [username]),
      pool.query("SELECT id FROM sponsors WHERE username = $1", [username]),
      pool.query("SELECT id FROM venues WHERE username = $1", [username])
    ];

    const results = await Promise.all(queries);
    
    // If any result has rows, username is taken
    const isTaken = results.some(result => result.rows.length > 0);

    res.json({ 
      available: !isTaken,
      username: username
    });

  } catch (error) {
    console.error("Error checking username:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Set username for authenticated user
const setUsername = async (req, res) => {
  try {
    const { username, userType } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!username || !userType) {
      return res.status(400).json({ error: "Username and userType are required" });
    }

    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_.]{3,30}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({ 
        error: "Username must be 3-30 characters long and contain only letters, numbers, underscores, and dots" 
      });
    }

    // Validate userType
    const validUserTypes = ['member', 'community', 'sponsor', 'venue'];
    if (!validUserTypes.includes(userType)) {
      return res.status(400).json({ error: "Invalid user type" });
    }

    // First check if username is available
    const checkQueries = [
      pool.query("SELECT id FROM members WHERE username = $1", [username]),
      pool.query("SELECT id FROM communities WHERE username = $1", [username]),
      pool.query("SELECT id FROM sponsors WHERE username = $1", [username]),
      pool.query("SELECT id FROM venues WHERE username = $1", [username])
    ];

    const checkResults = await Promise.all(checkQueries);
    const isTaken = checkResults.some(result => result.rows.length > 0);

    if (isTaken) {
      return res.status(400).json({ error: "Username is already taken" });
    }

    // Update username based on userType
    let updateQuery;
    let tableName;

    switch (userType) {
      case 'member':
        updateQuery = "UPDATE members SET username = $1 WHERE id = $2";
        tableName = 'members';
        break;
      case 'community':
        updateQuery = "UPDATE communities SET username = $1 WHERE id = $2";
        tableName = 'communities';
        break;
      case 'sponsor':
        updateQuery = "UPDATE sponsors SET username = $1 WHERE id = $2";
        tableName = 'sponsors';
        break;
      case 'venue':
        updateQuery = "UPDATE venues SET username = $1 WHERE id = $2";
        tableName = 'venues';
        break;
    }

    const result = await pool.query(updateQuery, [username, userId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ 
      success: true,
      username: username,
      message: "Username set successfully"
    });

  } catch (error) {
    console.error("Error setting username:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  checkUsername,
  setUsername
};
