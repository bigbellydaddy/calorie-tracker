export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' });
  }

  const { q, page = 1 } = req.query;
  if (!q) {
    return res.status(400).json({ error: 'Query parameter q is required' });
  }

  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'USDA API key not configured' });
  }

  try {
    // Search all data types, then filter/sort in our code for best results
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(q)}&pageSize=25&pageNumber=${page}&api_key=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 429) {
        return res.status(429).json({ error: 'Search temporarily unavailable, please enter macros manually' });
      }
      throw new Error('USDA API error: ' + response.status);
    }

    const data = await response.json();
    const results = (data.foods || [])
      .map(food => {
        const nutrients = {};
        (food.foodNutrients || []).forEach(n => {
          nutrients[n.nutrientId] = n.value || 0;
        });

        return {
          fdcId: food.fdcId,
          description: food.description || 'Unknown',
          brand: food.brandName || food.brandOwner || '',
          dataType: food.dataType || '',
          calories: nutrients[1008] || 0,
          protein: nutrients[1003] || 0,
          carbs: nutrients[1005] || 0,
          fat: nutrients[1004] || 0,
          servingSize: 100,
          servingUnit: 'g'
        };
      })
      // Filter out items with no calorie data (broken entries)
      .filter(r => r.calories > 0)
      // Prefer SR Legacy and Survey over Branded for cleaner generic foods
      .sort((a, b) => {
        const priority = { 'SR Legacy': 0, 'Survey (FNDDS)': 1, 'Branded': 2 };
        return (priority[a.dataType] ?? 3) - (priority[b.dataType] ?? 3);
      })
      .slice(0, 10);

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
