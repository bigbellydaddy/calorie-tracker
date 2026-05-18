import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' });
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    const { date, start, end } = req.query;

    if (start && end) {
      const rows = await sql`
        SELECT
          date,
          SUM(calories) as calories,
          SUM(protein) as protein,
          SUM(carbs) as carbs,
          SUM(fat) as fat,
          COUNT(*) as items
        FROM food_log
        WHERE user_id = 1 AND date >= ${start} AND date <= ${end}
        GROUP BY date
        ORDER BY date ASC
      `;

      const dayMap = {};
      rows.forEach(r => { dayMap[r.date.slice(0, 10)] = r; });

      const days = [];
      const d = new Date(start + 'T12:00:00');
      const endDate = new Date(end + 'T12:00:00');
      while (d <= endDate) {
        const ds = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
        days.push(dayMap[ds] || { date: ds, calories: 0, protein: 0, carbs: 0, fat: 0, items: 0 });
        d.setDate(d.getDate() + 1);
      }

      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
      return res.status(200).json({ days });
    }

    if (date) {
      const totalsRow = await sql`
        SELECT
          COALESCE(SUM(calories), 0) as calories,
          COALESCE(SUM(protein), 0) as protein,
          COALESCE(SUM(carbs), 0) as carbs,
          COALESCE(SUM(fat), 0) as fat,
          COUNT(*) as items
        FROM food_log
        WHERE user_id = 1 AND date = ${date}
      `;

      const mealRows = await sql`
        SELECT
          meal_type,
          SUM(calories) as calories,
          SUM(protein) as protein,
          SUM(carbs) as carbs,
          SUM(fat) as fat
        FROM food_log
        WHERE user_id = 1 AND date = ${date}
        GROUP BY meal_type
      `;

      const itemRows = await sql`
        SELECT id, food_name, meal_type, calories, protein, carbs, fat, serving_size, serving_unit
        FROM food_log
        WHERE user_id = 1 AND date = ${date}
        ORDER BY created_at ASC
      `;

      const meals = mealRows.map(m => ({
        ...m,
        items: itemRows.filter(i => i.meal_type === m.meal_type)
      }));

      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
      return res.status(200).json({
        totals: totalsRow[0],
        meals
      });
    }

    res.status(400).json({ error: 'Provide date or start+end params' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
