import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  try {
    if (req.method === 'GET') {
      let rows = await sql`SELECT * FROM daily_goals WHERE user_id = 1`;
      if (rows.length === 0) {
        rows = await sql`
          INSERT INTO daily_goals (user_id, calories, protein, carbs, fat)
          VALUES (1, 2000, 150, 250, 65)
          RETURNING *
        `;
      }
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
      return res.status(200).json(rows[0]);
    }

    if (req.method === 'PUT') {
      const { calories, protein, carbs, fat } = req.body;
      const rows = await sql`
        INSERT INTO daily_goals (user_id, calories, protein, carbs, fat)
        VALUES (1, ${calories}, ${protein}, ${carbs}, ${fat})
        ON CONFLICT (user_id) DO UPDATE SET
          calories = ${calories},
          protein = ${protein},
          carbs = ${carbs},
          fat = ${fat},
          updated_at = NOW()
        RETURNING *
      `;
      return res.status(200).json(rows[0]);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
