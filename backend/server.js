const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { Pool } = require("pg");
const routes = require("./routes");

const app = express();
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
});

pool
  .connect()
  .then(() => console.log("✅ Connected to PostgreSQL"))
  .catch((err) => console.error("❌ DB Connection Error", err));

// Expose pool to routes
app.locals.pool = pool;

// Ensure required tables exist
async function ensureTables() {
  try {
    await pool.query(`
      -- Members table
      CREATE TABLE IF NOT EXISTS members (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT NOT NULL,
        dob DATE NOT NULL,
        gender TEXT NOT NULL,
        city TEXT NOT NULL,
        interests JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      
      -- Communities table
      CREATE TABLE IF NOT EXISTS communities (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        bio TEXT NOT NULL,
        logo_url TEXT,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        requirements TEXT,
        interests JSONB,
        cities JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      
      -- Community heads (private info)
      CREATE TABLE IF NOT EXISTS community_heads (
        id BIGSERIAL PRIMARY KEY,
        community_id BIGINT REFERENCES communities(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      
      -- Sponsors table
      CREATE TABLE IF NOT EXISTS sponsors (
        id BIGSERIAL PRIMARY KEY,
        brand_name TEXT NOT NULL,
        bio TEXT NOT NULL,
        logo_url TEXT,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        requirements TEXT,
        interests JSONB,
        cities JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      
      -- Venues table
      CREATE TABLE IF NOT EXISTS venues (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        city TEXT NOT NULL,
        contact_name TEXT NOT NULL,
        contact_email TEXT NOT NULL,
        contact_phone TEXT NOT NULL,
        capacity_min INTEGER NOT NULL,
        capacity_max INTEGER NOT NULL,
        price_per_head DECIMAL(10,2) NOT NULL,
        conditions TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      
      -- Interests and cities lookup tables
      CREATE TABLE IF NOT EXISTS interests (
        id BIGSERIAL PRIMARY KEY,
        label TEXT UNIQUE NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS cities (
        id BIGSERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL
      );
      
      -- Many-to-many relationships
      CREATE TABLE IF NOT EXISTS community_interests (
        community_id BIGINT REFERENCES communities(id) ON DELETE CASCADE,
        interest_id BIGINT REFERENCES interests(id) ON DELETE CASCADE,
        PRIMARY KEY (community_id, interest_id)
      );
      
      CREATE TABLE IF NOT EXISTS community_cities (
        community_id BIGINT REFERENCES communities(id) ON DELETE CASCADE,
        city_id BIGINT REFERENCES cities(id) ON DELETE CASCADE,
        PRIMARY KEY (community_id, city_id)
      );
      
      CREATE TABLE IF NOT EXISTS sponsor_interests (
        sponsor_id BIGINT REFERENCES sponsors(id) ON DELETE CASCADE,
        interest_id BIGINT REFERENCES interests(id) ON DELETE CASCADE,
        PRIMARY KEY (sponsor_id, interest_id)
      );
      
      CREATE TABLE IF NOT EXISTS sponsor_cities (
        sponsor_id BIGINT REFERENCES sponsors(id) ON DELETE CASCADE,
        city_id BIGINT REFERENCES cities(id) ON DELETE CASCADE,
        PRIMARY KEY (sponsor_id, city_id)
      );
      
      -- Add constraints
      DO $$ BEGIN
        ALTER TABLE members ADD CONSTRAINT phone_10_digits CHECK (phone ~ '^\\d{10}$');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE members ADD CONSTRAINT gender_allowed CHECK (gender IN ('Male','Female','Non-binary'));
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE members ADD CONSTRAINT interests_len CHECK (
          jsonb_typeof(interests) = 'array' AND jsonb_array_length(interests) BETWEEN 3 AND 7
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    console.log("✅ Ensured all tables");
  } catch (err) {
    console.error("❌ Failed ensuring tables", err);
  }
}

ensureTables();

// Load routes
app.use("/", routes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
