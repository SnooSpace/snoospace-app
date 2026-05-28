// Quick syntax check — require all modified modules
try { require('../utils/signalEmitter'); console.log('✓ signalEmitter'); } catch(e) { console.error('✗ signalEmitter:', e.message); }
try { require('../utils/postEventAttendanceResolver'); console.log('✓ postEventAttendanceResolver'); } catch(e) { console.error('✗ postEventAttendanceResolver:', e.message); }
try { require('../controllers/searchController'); console.log('✓ searchController'); } catch(e) { console.error('✗ searchController:', e.message); }
try { require('../jobs/learnDemographicScores'); console.log('✓ learnDemographicScores'); } catch(e) { console.error('✗ learnDemographicScores:', e.message); }
try { require('../routes/videoInsights'); console.log('✓ videoInsights route'); } catch(e) { console.error('✗ videoInsights route:', e.message); }
try { require('../services/schedulerService'); console.log('✓ schedulerService'); } catch(e) { console.error('✗ schedulerService:', e.message); }
try { require('../controllers/audienceIntelligenceController'); console.log('✓ audienceIntelligenceController'); } catch(e) { console.error('✗ audienceIntelligenceController:', e.message); }
console.log('--- Done ---');
