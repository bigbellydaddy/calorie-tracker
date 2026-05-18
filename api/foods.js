import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  try {
    if (req.method === 'GET') {
      const { date, recent, days } = req.query;

      if (recent === 'true') {
        const rows = await sql`
          SELECT DISTINCT ON (food_name) food_name, calories, protein, carbs, fat, serving_size, serving_unit
          FROM food_log
          WHERE user_id = 1
          ORDER BY food_name, created_at DESC
          LIMIT 10
        `;
        return res.status(200).json({ foods: rows });
      }

      if (days) {
        const numDays = parseInt(days);
        const rows = await sql`
          SELECT * FROM food_log
          WHERE user_id = 1 AND date >= CURRENT_DATE - ${numDays}
          ORDER BY date DESC, created_at DESC
        `;
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
        return res.status(200).json({ foods: rows });
      }

      const rows = await sql`
        SELECT * FROM food_log
        WHERE user_id = 1 AND date = ${date}
        ORDER BY
          CASE meal_type
            WHEN 'breakfast' THEN 1
            WHEN 'lunch' THEN 2
            WHEN 'dinner' THEN 3
            WHEN 'snacks' THEN 4
          END,
          created_at ASC
      `;
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
      return res.status(200).json({ foods: rows });
    }

    if (req.method === 'POST') {
      const { food_name, meal_type, calories, protein, carbs, fat, serving_size, serving_unit, date } = req.body;
      const rows = await sql`
        INSERT INTO food_log (user_id, food_name, meal_type, calories, protein, carbs, fat, serving_size, serving_unit, date)
        VALUES (1, ${food_name}, ${meal_type}, ${calories}, ${protein}, ${carbs}, ${fat}, ${serving_size}, ${serving_unit}, ${date})
        RETURNING *
      `;
      return res.status(201).json(rows[0]);
    }

    if (req.method === 'PUT') {
      const { id } = req.query;
      const { food_name, meal_type, calories, protein, carbs, fat, serving_size, serving_unit } = req.body;
      const rows = await sql`
        UPDATE food_log SET
          food_name = ${food_name},
          meal_type = ${meal_type},
          calories = ${calories},
          protein = ${protein},
          carbs = ${carbs},
          fat = ${fat},
          serving_size = ${serving_size},
          serving_unit = ${serving_unit}
        WHERE id = ${id} AND user_id = 1
        RETURNING *
      `;
      return res.status(200).json(rows[0]);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await sql`DELETE FROM food_log WHERE id = ${id} AND user_id = 1`;
      return res.status(200).json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
