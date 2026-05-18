import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  try {
    if (req.method === 'GET') {
      const days = parseInt(req.query.days) || 30;
      const rows = await sql`
        SELECT id, weight, date
        FROM weight_log
        WHERE user_id = 1 AND date >= CURRENT_DATE - ${days}
        ORDER BY date ASC
      `;
      res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');
      return res.status(200).json({ weights: rows });
    }

    if (req.method === 'POST') {
      const { weight, date } = req.body;
      const rows = await sql`
        INSERT INTO weight_log (user_id, weight, date)
        VALUES (1, ${weight}, ${date})
        ON CONFLICT ON CONSTRAINT weight_log_user_date_unique
        DO UPDATE SET weight = ${weight}
        RETURNING *
      `;
      return res.status(201).json(rows[0]);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await sql`DELETE FROM weight_log WHERE id = ${id} AND user_id = 1`;
      return res.status(200).json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
