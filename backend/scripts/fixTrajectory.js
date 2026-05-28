require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createPool } = require('../config/db');
const p = createPool();
// trajectory was set to 'declining' by the recalc that ran before the snapshot reset.
// snapshot is now equal to current score → delta = 0 → should be stable
p.query(
  `UPDATE user_aqi_signals SET aqi_trajectory = 'stable'
   WHERE user_id = 51 AND aqi_score_4w_ago IS NOT DISTINCT FROM aqi_score`
).then(r => {
  console.log('✓ Trajectory corrected to stable. rows:', r.rowCount);
  return p.end();
}).catch(e => { console.error(e.message); p.end(); });
