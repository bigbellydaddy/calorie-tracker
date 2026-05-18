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

      res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');
      return res.status(200).json({ days });
    }

    if (date) {
      // Single query instead of 3 — saves 2 DB round trips per dashboard load
      const itemRows = await sql`
        SELECT id, food_name, meal_type, calories, protein, carbs, fat, serving_size, serving_unit
        FROM food_log
        WHERE user_id = 1 AND date = ${date}
        ORDER BY created_at ASC
      `;

      // Compute totals and meal breakdowns in JS (free) instead of DB (costs compute)
      const totals = { calories: 0, protein: 0, carbs: 0, fat: 0, items: itemRows.length };
      const mealMap = {};
      for (const item of itemRows) {
        totals.calories += Number(item.calories);
        totals.protein += Number(item.protein);
        totals.carbs += Number(item.carbs);
        totals.fat += Number(item.fat);
        if (!mealMap[item.meal_type]) {
          mealMap[item.meal_type] = { meal_type: item.meal_type, calories: 0, protein: 0, carbs: 0, fat: 0, items: [] };
        }
        mealMap[item.meal_type].calories += Number(item.calories);
        mealMap[item.meal_type].protein += Number(item.protein);
        mealMap[item.meal_type].carbs += Number(item.carbs);
        mealMap[item.meal_type].fat += Number(item.fat);
        mealMap[item.meal_type].items.push(item);
      }

      res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');
      return res.status(200).json({
        totals,
        meals: Object.values(mealMap)
      });
    }

    res.status(400).json({ error: 'Provide date or start+end params' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
