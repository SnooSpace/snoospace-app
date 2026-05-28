require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createPool } = require('../config/db');
const p = createPool();
p.query(
  `SELECT column_name, data_type, numeric_precision, numeric_scale
   FROM information_schema.columns
   WHERE table_name='user_aqi_signals'
   AND column_name IN ('professional_hours_ratio','engagement_hour_pattern','premium_categories_ratio','rsvp_to_attend_ratio')`
).then(r => { r.rows.forEach(c => console.log(c)); p.end(); })
 .catch(e => { console.error(e.message); p.end(); });
