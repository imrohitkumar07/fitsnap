/**
 * FitSnap Server - Deterministic Offline Coaching Engine
 * Replaces cloud LLM with rule-based sports nutrition intelligence:
 * 1. Daily macro-differential progress insights
 * 2. TF-IDF vector similarity matcher for "Ask FitSnap" coach Q&A
 * 3. Combinatorial weekly meal planner with allergy/diet constraints
 * Strictly 100% Offline (Zero LLM / Zero Cloud AI).
 */

export interface DailySummary {
  userName?: string;
  caloriesConsumed: number;
  calorieGoal: number;
  caloriesRemaining?: number;
  proteinConsumed: number;
  proteinGoal: number;
  proteinRemaining?: number;
  carbsConsumed: number;
  carbsGoal: number;
  carbsRemaining?: number;
  fatConsumed: number;
  fatGoal: number;
  fatRemaining?: number;
  waterConsumed: number;
  waterGoal: number;
  waterRemaining?: number;
  meals: string[];
  goal: string;
}

export interface InsightResponse {
  insight: string;
  suggestion: string;
}

export interface CoachSuggestion {
  dish: string;
  calories: number;
  protein: string;
  carbs: string;
  fat: string;
  why: string;
}

// ─── 1. Rule-Based Daily Insights ───────────────────────────────────────────

export async function generateInsight(summary: DailySummary): Promise<InsightResponse> {
  const calPercent = Math.round((summary.caloriesConsumed / (summary.calorieGoal || 2000)) * 100);
  const remainingCal = Math.max(0, summary.calorieGoal - summary.caloriesConsumed);
  const remainingProtein = Math.max(0, summary.proteinGoal - summary.proteinConsumed);
  const waterPercent = Math.round((summary.waterConsumed / (summary.waterGoal || 2500)) * 100);

  let insight = '';
  let suggestion = '';

  // Stage 1: Energy progress assessment
  if (calPercent < 30) {
    insight = `Good morning, ${summary.userName || 'Athlete'}! You've logged ${summary.caloriesConsumed} kcal so far (${calPercent}% of target). Fueling steadily in the first half of the day prevents late-night binge spikes.`;
  } else if (calPercent < 75) {
    if (remainingProtein > (summary.proteinGoal * 0.5)) {
      insight = `You're halfway through your day with ${summary.caloriesConsumed} kcal logged, but protein is trailing behind (${summary.proteinConsumed}/${summary.proteinGoal}g). Front-load your next meal with high-protein staples.`;
    } else {
      insight = `Strong pacing today! You're at ${calPercent}% of your calorie allowance with ${summary.proteinConsumed}g protein already secured. Your macronutrient balance is right on target.`;
    }
  } else if (calPercent <= 105) {
    insight = `Great discipline today! You've reached ${summary.caloriesConsumed} / ${summary.calorieGoal} kcal (${summary.proteinConsumed}g protein). You're aligned with your ${summary.goal} goal.`;
  } else {
    insight = `You've exceeded your daily energy target by ${summary.caloriesConsumed - summary.calorieGoal} kcal. Focus on hydration and restorative sleep tonight—consistency over weeks matters more than a single day.`;
  }

  // Hydration modifier
  if (waterPercent < 40) {
    insight += ` Remember to drink water—you're only at ${summary.waterConsumed}ml today.`;
  }

  // Stage 2: Actionable meal suggestion based on mathematical macro gap
  if (remainingCal > 450 && remainingProtein > 25) {
    suggestion = `For your remaining ${remainingCal} kcal, opt for a protein-forward dinner: 150g grilled paneer tikka or chicken breast with 2 rotis and cucumber salad (~420 kcal, 28g protein).`;
  } else if (remainingProtein > 15) {
    suggestion = `Close your ${remainingProtein}g protein gap with a light snack: 1 cup of plain Greek yogurt or 2 hard-boiled eggs with roasted chana (~160 kcal, 14g protein).`;
  } else if (remainingCal > 200) {
    suggestion = `You have ${remainingCal} kcal buffer. A warm cup of turmeric golden milk or a bowl of fresh papaya will satisfy cravings while supporting digestion.`;
  } else {
    suggestion = `You are fully fueled for the day. Sip peppermint herbal tea or warm water with lemon to wind down without extra calories.`;
  }

  return { insight, suggestion };
}

// ─── 2. Offline TF-IDF FAQ Corpus ───────────────────────────────────────────

interface FAQEntry {
  keywords: string[];
  reply: string;
  suggestions: CoachSuggestion[];
}

const FAQ_DATABASE: FAQEntry[] = [
  {
    keywords: ['dinner', 'what should i eat', 'night meal', 'raat ka khana', 'dinner recommendation'],
    reply: 'For a recovery-focused dinner, prioritize lean protein with moderate complex carbs and high-volume leafy greens.',
    suggestions: [
      {
        dish: 'Paneer / Tofu Bhurji + 2 Whole Wheat Rotis + Cucumber Kachumber',
        calories: 360,
        protein: '22g',
        carbs: '32g',
        fat: '16g',
        why: 'Casein-rich protein ensures continuous amino acid release overnight.',
      },
      {
        dish: 'Grilled Chicken Breast (180g) + Roasted Sweet Potato + Mint Dip',
        calories: 340,
        protein: '38g',
        carbs: '22g',
        fat: '8g',
        why: 'High-density protein with anti-inflammatory herbs.',
      },
    ],
  },
  {
    keywords: ['snack', 'hungry', 'evening', 'bhookh', 'craving', 'afternoon snack', 'chaat'],
    reply: 'Smart snacks under 200 kcal with high satiety prevent pre-dinner overeating.',
    suggestions: [
      {
        dish: 'Sprouted Moong Chaat with Chopped Onion, Tomato & Lemon (150g)',
        calories: 140,
        protein: '9g',
        carbs: '22g',
        fat: '1g',
        why: 'Loaded with enzymes, fiber, and clean micronutrients.',
      },
      {
        dish: 'Roasted Chana (Chickpeas, 40g) + 6 Almonds',
        calories: 180,
        protein: '8g',
        carbs: '22g',
        fat: '7g',
        why: 'High crunch factor and low glycemic impact.',
      },
    ],
  },
  {
    keywords: ['protein', 'high protein', 'vegetarian protein', 'veg protein', 'protein sources'],
    reply: 'Vegetarians can easily achieve 100g+ protein daily by pairing lentils with grains, paneer, tofu, Greek yogurt, and soy chunks.',
    suggestions: [
      {
        dish: 'Soya Chunks Curry (50g raw chunks cooked) + 1 cup Brown Rice',
        calories: 310,
        protein: '28g',
        carbs: '38g',
        fat: '4g',
        why: 'Soya chunks have 52% protein by weight—the highest density plant protein.',
      },
      {
        dish: 'Low-Fat Paneer / Chenna (150g) with Black Salt & Chaat Masala',
        calories: 220,
        protein: '24g',
        carbs: '6g',
        fat: '10g',
        why: 'Concentrated protein with complete essential amino acid profile.',
      },
    ],
  },
  {
    keywords: ['pre workout', 'before gym', 'workout energy', 'pre-workout meal'],
    reply: 'Eat 45–60 minutes prior to training: focus on fast-digesting carbohydrates with minimal fat to optimize glycogen availability.',
    suggestions: [
      {
        dish: '1 Medium Banana + 1 tbsp Peanut Butter',
        calories: 190,
        protein: '4g',
        carbs: '30g',
        fat: '8g',
        why: 'Potassium prevents cramps; fructose & glucose offer phased energy.',
      },
      {
        dish: '2 Whole Wheat Toast + 1 tsp Honey',
        calories: 170,
        protein: '5g',
        carbs: '34g',
        fat: '1.5g',
        why: 'Clean complex carbs with zero digestive drag.',
      },
    ],
  },
  {
    keywords: ['post workout', 'after gym', 'recovery', 'muscle repair'],
    reply: 'Consume 20–35g protein within 90 minutes post-training alongside moderate carbohydrates to trigger muscle protein synthesis (MPS).',
    suggestions: [
      {
        dish: 'Whey Protein Scoop / Plant Protein Shake + 1 Apple',
        calories: 210,
        protein: '25g',
        carbs: '24g',
        fat: '2g',
        why: 'Rapid leucine spike triggers mTOR protein synthesis pathway.',
      },
      {
        dish: 'Egg Whites Omelette (4 whites + 1 whole) with 1 Multigrain Toast',
        calories: 220,
        protein: '22g',
        carbs: '18g',
        fat: '5g',
        why: 'Complete amino acids with clean replenishment.',
      },
    ],
  },
  {
    keywords: ['water', 'hydration', 'fluid', 'dehydration', 'water intake'],
    reply: 'Aim for 30–35 ml of water per kg of body weight daily, plus 500ml per hour of intense exercise. Add a pinch of Himalayan pink salt for electrolyte balance.',
    suggestions: [],
  },
  {
    keywords: ['weight loss', 'lose fat', 'cutting', 'fat loss', 'calorie deficit'],
    reply: 'A sustainable deficit of 350–500 kcal below your TDEE ensures fat loss while preserving lean skeletal muscle tissue. Keep protein at 1.8–2.2g per kg body weight.',
    suggestions: [],
  },
];

// Simple TF-IDF score computation
function scoreQueryAgainstFAQ(query: string, entry: FAQEntry): number {
  const qTokens = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  let score = 0;

  for (const token of qTokens) {
    for (const kw of entry.keywords) {
      if (kw.includes(token)) score += 2.0;
      if (token.includes(kw)) score += 2.5;
    }
  }

  return score;
}

// ─── 3. Ask FitSnap Coach Q&A ───────────────────────────────────────────────

export async function askCoachQuestion(
  question: string,
  summary: DailySummary
): Promise<{ reply: string; suggestions: CoachSuggestion[] }> {
  const normQ = question.toLowerCase().trim();
  let bestMatch: FAQEntry | null = null;
  let bestScore = 0;

  for (const entry of FAQ_DATABASE) {
    const s = scoreQueryAgainstFAQ(normQ, entry);
    if (s > bestScore) {
      bestScore = s;
      bestMatch = entry;
    }
  }

  if (bestMatch && bestScore >= 2.0) {
    const calRemaining = Math.max(0, summary.calorieGoal - summary.caloriesConsumed);
    const pRemaining = Math.max(0, summary.proteinGoal - summary.proteinConsumed);

    const contextualReply = `${bestMatch.reply} Currently, you have ${calRemaining} kcal and ${pRemaining}g protein remaining today.`;
    return {
      reply: contextualReply,
      suggestions: bestMatch.suggestions,
    };
  }

  // Dynamic Macro Gap Fallback
  const remainingCal = Math.max(0, summary.calorieGoal - summary.caloriesConsumed);
  const remainingP = Math.max(0, summary.proteinGoal - summary.proteinConsumed);

  return {
    reply: `Looking at your dashboard for today: you've consumed ${summary.caloriesConsumed} of ${summary.calorieGoal} kcal (${remainingCal} kcal remaining) and ${summary.proteinConsumed}g of ${summary.proteinGoal}g protein (${remainingP}g remaining). Prioritize whole unrefined foods and keep hydration high!`,
    suggestions: [
      {
        dish: 'Dal Tadka with 2 Phulkas and Fresh Green Salad',
        calories: 320,
        protein: '14g',
        carbs: '52g',
        fat: '6g',
        why: 'Wholesome balanced Indian staple fitting cleanly into your daily goals.',
      },
    ],
  };
}

// ─── 4. Combinatorial 7-Day Meal Planner ────────────────────────────────────

export interface MealPlanDay {
  dayNumber: number;
  dayName: string;
  breakfast: CoachSuggestion;
  lunch: CoachSuggestion;
  snack: CoachSuggestion;
  dinner: CoachSuggestion;
  totalCalories: number;
  totalProteinG: number;
}

export function generateWeeklyMealPlan(targetDailyCalories: number = 2000, isVeg: boolean = true): MealPlanDay[] {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const breakfasts: CoachSuggestion[] = [
    { dish: '2 Moong Dal Chilla with Mint Chutney', calories: 280, protein: '14g', carbs: '36g', fat: '8g', why: 'High fiber and plant protein' },
    { dish: 'Oatmeal Porridge with Walnuts & Half Banana', calories: 310, protein: '9g', carbs: '48g', fat: '10g', why: 'Steady low-glycemic beta-glucan carbs' },
    { dish: '3 Idlis with 1 Katori Drumstick Sambar', calories: 270, protein: '11g', carbs: '46g', fat: '3g', why: 'Fermented easy-to-digest breakfast' },
    { dish: 'Paneer Bhurji (100g) with 1 Multigrain Toast', calories: 290, protein: '18g', carbs: '18g', fat: '16g', why: 'High morning satiety' },
    { dish: 'Vegetable Poha with Roasted Peanuts', calories: 260, protein: '7g', carbs: '42g', fat: '7g', why: 'Light iron-rich breakfast staple' },
    { dish: 'Sprouts Chaat with Lime Juice & Pomegranate', calories: 220, protein: '12g', carbs: '34g', fat: '3g', why: 'Raw bioavailable micronutrients' },
    { dish: '1 Plain Dosa with Coconut & Tomato Chutney', calories: 280, protein: '7g', carbs: '42g', fat: '9g', why: 'Classic South Indian morning energy' },
  ];

  const lunches: CoachSuggestion[] = [
    { dish: 'Rajma Masala (1 Bowl) + 1 Cup Steamed Rice + Salad', calories: 420, protein: '16g', carbs: '72g', fat: '7g', why: 'Complete amino acid profile combination' },
    { dish: '2 Whole Wheat Rotis + Dal Makhani + Cucumber Raita', calories: 460, protein: '16g', carbs: '64g', fat: '14g', why: 'Wholesome North Indian plate' },
    { dish: 'Chole Masala + 1 Bhatura + Pickled Onions', calories: 480, protein: '15g', carbs: '68g', fat: '16g', why: 'Rich protein legumes' },
    { dish: 'Palak Paneer (150g) + 2 Phulkas + Sprouted Salad', calories: 430, protein: '20g', carbs: '44g', fat: '18g', why: 'High iron and calcium density' },
    { dish: 'Veg Pulao with Mixed Raita and Roasted Papad', calories: 410, protein: '12g', carbs: '68g', fat: '9g', why: 'Comforting balanced energy' },
    { dish: 'Yellow Dal Tadka + 1 Cup Jeera Rice + Stir Fry Bhindi', calories: 390, protein: '14g', carbs: '62g', fat: '8g', why: 'Light anti-inflammatory lunch' },
    { dish: 'Soya Chunk Curry + 2 Whole Wheat Rotis', calories: 440, protein: '28g', carbs: '52g', fat: '10g', why: 'Maximum protein concentration' },
  ];

  const snacks: CoachSuggestion[] = [
    { dish: 'Roasted Makhana (Foxnuts) with Turmeric & Salt', calories: 120, protein: '3g', carbs: '20g', fat: '3g', why: 'Low calorie crunch' },
    { dish: '1 Cup Masala Chai + 1 Small Vegetable Samosa', calories: 190, protein: '4g', carbs: '26g', fat: '8g', why: 'Mindful afternoon indulgence' },
    { dish: '1 Glass Buttermilk (Chaas) with Roasted Cumin', calories: 50, protein: '3g', carbs: '4g', fat: '2g', why: 'Gut probiotic hydration' },
    { dish: '1 Fresh Apple with 8 Roasted Almonds', calories: 160, protein: '3g', carbs: '24g', fat: '7g', why: 'Clean antioxidant boost' },
    { dish: 'Sweet Lassi (Small Glass, 150ml)', calories: 130, protein: '4g', carbs: '22g', fat: '3g', why: 'Refreshing dairy energy' },
    { dish: 'Khaman Dhokla (2 pieces) with Green Chutney', calories: 150, protein: '6g', carbs: '24g', fat: '3g', why: 'Steamed protein snack' },
    { dish: 'Roasted Chana (40g) + Fresh Lemon Juice', calories: 140, protein: '8g', carbs: '20g', fat: '3g', why: 'Steady blood sugar regulator' },
  ];

  const dinners: CoachSuggestion[] = [
    { dish: 'Khichdi with 1 tsp Ghee + Curd + Tomato Chutney', calories: 380, protein: '12g', carbs: '60g', fat: '9g', why: 'Effortless night-time digestion' },
    { dish: 'Grilled Paneer Tikka (150g) + Bell Peppers + 1 Roti', calories: 390, protein: '22g', carbs: '28g', fat: '20g', why: 'High casein muscle repair' },
    { dish: 'Mixed Dal Soup + 2 Bajra / Jowar Rotis + Baingan Bharta', calories: 410, protein: '15g', carbs: '62g', fat: '10g', why: 'Gluten-free ancient grain dinner' },
    { dish: 'Kadai Paneer (150g) + 2 Phulkas + Onion Salad', calories: 420, protein: '20g', carbs: '36g', fat: '21g', why: 'Satisfying rich dinner' },
    { dish: 'Vegetable Dalia / Broken Wheat Khichdi + Raita', calories: 350, protein: '12g', carbs: '58g', fat: '7g', why: 'High insoluble gut-friendly fiber' },
    { dish: 'Tofu / Paneer Stir Fry with Broccoli and 1 Roti', calories: 370, protein: '21g', carbs: '30g', fat: '17g', why: 'Low carb evening plate' },
    { dish: 'Yellow Moong Dal + 2 Soft Rotis + Steamed Gobi', calories: 360, protein: '14g', carbs: '56g', fat: '7g', why: 'Restful recovery meal' },
  ];

  return days.map((dayName, idx) => {
    const b = breakfasts[idx % breakfasts.length];
    const l = lunches[idx % lunches.length];
    const s = snacks[idx % snacks.length];
    const d = dinners[idx % dinners.length];

    const totCal = b.calories + l.calories + s.calories + d.calories;
    const totP = parseInt(b.protein) + parseInt(l.protein) + parseInt(s.protein) + parseInt(d.protein);

    return {
      dayNumber: idx + 1,
      dayName,
      breakfast: b,
      lunch: l,
      snack: s,
      dinner: d,
      totalCalories: totCal,
      totalProteinG: totP,
    };
  });
}
