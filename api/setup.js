import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS food_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL DEFAULT 1,
        food_name VARCHAR(200) NOT NULL,
        meal_type VARCHAR(20) NOT NULL,
        calories DECIMAL(7,1) NOT NULL,
        protein DECIMAL(6,1) NOT NULL,
        carbs DECIMAL(6,1) NOT NULL,
        fat DECIMAL(6,1) NOT NULL,
        serving_size DECIMAL(6,1),
        serving_unit VARCHAR(30),
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS daily_goals (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL DEFAULT 1,
        calories INTEGER NOT NULL DEFAULT 2000,
        protein INTEGER NOT NULL DEFAULT 150,
        carbs INTEGER NOT NULL DEFAULT 250,
        fat INTEGER NOT NULL DEFAULT 65,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT daily_goals_user_unique UNIQUE (user_id)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS weight_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL DEFAULT 1,
        weight DECIMAL(5,1) NOT NULL,
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT weight_log_user_date_unique UNIQUE (user_id, date)
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_food_log_date ON food_log(user_id, date)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_weight_log_date ON weight_log(user_id, date)`;
    // Dropped idx_food_log_meal — redundant with idx_food_log_date, saves storage

    res.status(200).json({ success: true, message: 'All tables and indexes created' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
