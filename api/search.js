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
    // Prioritize Foundation + SR Legacy for cleaner data, fall back to all types
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(q)}&pageSize=15&pageNumber=${page}&dataType=Foundation,SR%20Legacy,Survey%20(FNDDS)&api_key=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 429) {
        return res.status(429).json({ error: 'Search temporarily unavailable, please enter macros manually' });
      }
      throw new Error('USDA API error: ' + response.status);
    }

    const data = await response.json();
    const results = (data.foods || []).map(food => {
      const nutrients = {};
      (food.foodNutrients || []).forEach(n => {
        nutrients[n.nutrientId] = n.value || 0;
      });

      return {
        fdcId: food.fdcId,
        description: food.description || 'Unknown',
        brand: food.brandName || food.brandOwner || '',
        calories: nutrients[1008] || 0,
        protein: nutrients[1003] || 0,
        carbs: nutrients[1005] || 0,
        fat: nutrients[1004] || 0,
        servingSize: 100,
        servingUnit: 'g'
      };
    });

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
