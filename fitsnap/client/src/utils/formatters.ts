/**
 * Format a calorie value with commas and unit.
 * @example formatCalories(1234) → "1,234 kcal"
 */
export function formatCalories(n: number): string {
  return `${n.toLocaleString()} kcal`;
}

/**
 * Format a weight in grams to the most appropriate unit.
 * @example formatWeight(1500) → "1.5 kg"
 * @example formatWeight(250)  → "250g"
 */
export function formatWeight(g: number): string {
  if (g >= 1000) {
    const kg = g / 1000;
    return `${kg % 1 === 0 ? kg : kg.toFixed(1)} kg`;
  }
  return `${Math.round(g)}g`;
}

/**
 * Format milliliters of water to a readable string.
 * @example formatWater(1500) → "1.5L"
 * @example formatWater(250)  → "250ml"
 */
export function formatWater(ml: number): string {
  if (ml >= 1000) {
    const liters = ml / 1000;
    return `${liters % 1 === 0 ? liters : liters.toFixed(1)}L`;
  }
  return `${Math.round(ml)}ml`;
}

/**
 * Format a date to a human-readable string.
 * @example formatDate(new Date()) → "Oct 24, 2026"
 */
export function formatDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a serving size, preferring the label if provided.
 * @example formatServing(150, "1 cup")  → "1 cup (150g)"
 * @example formatServing(200, undefined) → "200g"
 */
export function formatServing(portionG: number, portionLabel?: string): string {
  if (portionLabel) {
    return `${portionLabel} (${Math.round(portionG)}g)`;
  }
  return `${Math.round(portionG)}g`;
}
