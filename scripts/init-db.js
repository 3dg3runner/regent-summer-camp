/**
 * Manually re-initialize the schema. Useful if you've blown away the data dir
 * and want to start fresh without running the full server.
 *
 *    npm run init-db
 */

require('dotenv').config();
require('../src/config/database'); // schema runs as a side effect

console.log('Database initialized at', process.env.DATABASE_PATH || './data/rsc.db');
