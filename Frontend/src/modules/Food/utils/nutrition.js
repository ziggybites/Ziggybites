export const getNutritionSummary = (nutrition) => {
  if (!nutrition || typeof nutrition !== "object") return "";

  const toNumber = (value) => {
    if (value === "" || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  };

  const parts = [];
  const calories = toNumber(nutrition.calories ?? nutrition.kcal);
  const protein = toNumber(nutrition.protein);
  const fiber = toNumber(nutrition.fiber ?? nutrition.fibre);

  if (calories !== null) parts.push(`${calories} kcal`);
  if (protein !== null) parts.push(`${protein}g Protein`);
  if (fiber !== null) parts.push(`${fiber}g Fiber`);

  return parts.join(" | ");
};
