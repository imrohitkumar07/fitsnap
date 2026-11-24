/**
 * FitSnap Server - Deterministic Voice & Text Meal Grammar Parser
 * Strictly 100% Offline Rule-Based NLP (Zero LLM / Zero Cloud AI).
 * Accurately parses multi-item sentences in English, Hindi, and Hinglish.
 */

export interface ParsedMealItem {
  name: string;
  matchedFoodKey: string;
  portionG: number;
  portionLabel: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  confidence: number;
  isAiEstimate: boolean;
}

// ─── 1. Number Word Maps ──────────────────────────────────────────────────────

const NUMBER_MAP: Record<string, number> = {
  'a': 1,
  'an': 1,
  'one': 1,
  'ek': 1,
  'ik': 1,
  'two': 2,
  'do': 2,
  'three': 3,
  'teen': 3,
  'tin': 3,
  'four': 4,
  'char': 4,
  'chaar': 4,
  'five': 5,
  'panch': 5,
  'paanch': 5,
  'six': 6,
  'che': 6,
  'chhe': 6,
  'seven': 7,
  'saat': 7,
  'sat': 7,
  'eight': 8,
  'aath': 8,
  'ath': 8,
  'nine': 9,
  'nau': 9,
  'ten': 10,
  'das': 10,
  'half': 0.5,
  'aadha': 0.5,
  'adha': 0.5,
  'quarter': 0.25,
  'dedh': 1.5,
  'dhedh': 1.5,
  'dhai': 2.5,
  'dhaai': 2.5,
};

// ─── 2. Serving Unit Types ────────────────────────────────────────────────────

interface UnitDef {
  multiplierG: number;
  label: string;
}

const UNIT_MAP: Record<string, UnitDef> = {
  'katori': { multiplierG: 180, label: 'katori' },
  'katoris': { multiplierG: 180, label: 'katoris' },
  'bowl': { multiplierG: 180, label: 'bowl' },
  'bowls': { multiplierG: 180, label: 'bowls' },
  'plate': { multiplierG: 250, label: 'plate' },
  'plates': { multiplierG: 250, label: 'plates' },
  'thali': { multiplierG: 350, label: 'thali' },
  'glass': { multiplierG: 220, label: 'glass' },
  'glasses': { multiplierG: 220, label: 'glasses' },
  'cup': { multiplierG: 160, label: 'cup' },
  'cups': { multiplierG: 160, label: 'cups' },
  'mug': { multiplierG: 250, label: 'mug' },
  'mugs': { multiplierG: 250, label: 'mugs' },
  'spoon': { multiplierG: 15, label: 'spoon' },
  'spoons': { multiplierG: 15, label: 'spoons' },
  'tbsp': { multiplierG: 15, label: 'tbsp' },
  'tablespoon': { multiplierG: 15, label: 'tablespoon' },
  'tablespoons': { multiplierG: 15, label: 'tablespoons' },
  'tsp': { multiplierG: 5, label: 'tsp' },
  'teaspoon': { multiplierG: 5, label: 'teaspoon' },
  'teaspoons': { multiplierG: 5, label: 'teaspoons' },
  'chamach': { multiplierG: 15, label: 'chamach' },
  'slice': { multiplierG: 30, label: 'slice' },
  'slices': { multiplierG: 30, label: 'slices' },
  'piece': { multiplierG: 50, label: 'piece' },
  'pieces': { multiplierG: 50, label: 'pieces' },
  'pc': { multiplierG: 50, label: 'pc' },
  'pcs': { multiplierG: 50, label: 'pcs' },
  'tukda': { multiplierG: 40, label: 'tukda' },
  'serving': { multiplierG: 150, label: 'serving' },
  'servings': { multiplierG: 150, label: 'servings' },
  'portion': { multiplierG: 150, label: 'portion' },
  'portions': { multiplierG: 150, label: 'portions' },
  'bottle': { multiplierG: 500, label: 'bottle' },
  'can': { multiplierG: 330, label: 'can' },
};

// ─── 3. Food Catalog Reference (per 100g) ───────────────────────────────────

interface FoodDefinition {
  canonicalName: string;
  aliases: string[];
  defaultPortionG: number;
  defaultUnitName: string;
  calPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
}

const FOOD_CATALOG: FoodDefinition[] = [
  // Breads / Rotis
  {
    canonicalName: 'Whole Wheat Roti',
    aliases: ['roti', 'rotis', 'chapati', 'chapatis', 'phulka', 'phulkas', 'fulka', 'rotiyan'],
    defaultPortionG: 35,
    defaultUnitName: 'piece',
    calPer100g: 260,
    proteinPer100g: 8.5,
    carbsPer100g: 50.0,
    fatPer100g: 2.5,
    fiberPer100g: 6.0,
  },
  {
    canonicalName: 'Plain Paratha',
    aliases: ['paratha', 'parathas', 'parotha', 'parathaas', 'plain paratha'],
    defaultPortionG: 75,
    defaultUnitName: 'piece',
    calPer100g: 310,
    proteinPer100g: 6.5,
    carbsPer100g: 40.0,
    fatPer100g: 14.0,
    fiberPer100g: 4.0,
  },
  {
    canonicalName: 'Aloo Paratha',
    aliases: ['aloo parathas', 'aloo paratha', 'alu parathas', 'alu paratha', 'potato parathas', 'potato paratha'],
    defaultPortionG: 110,
    defaultUnitName: 'piece',
    calPer100g: 250,
    proteinPer100g: 5.5,
    carbsPer100g: 38.0,
    fatPer100g: 9.0,
    fiberPer100g: 3.5,
  },
  {
    canonicalName: 'Butter Naan',
    aliases: ['butter naan', 'naan', 'naans', 'garlic naan', 'plain naan'],
    defaultPortionG: 90,
    defaultUnitName: 'piece',
    calPer100g: 315,
    proteinPer100g: 8.2,
    carbsPer100g: 52.0,
    fatPer100g: 8.5,
    fiberPer100g: 2.5,
  },
  {
    canonicalName: 'Puri',
    aliases: ['puri', 'puris', 'poori', 'pooris'],
    defaultPortionG: 30,
    defaultUnitName: 'piece',
    calPer100g: 380,
    proteinPer100g: 6.0,
    carbsPer100g: 48.0,
    fatPer100g: 18.5,
    fiberPer100g: 3.0,
  },
  {
    canonicalName: 'Bhatura',
    aliases: ['bhatura', 'bhature', 'bhatoora'],
    defaultPortionG: 85,
    defaultUnitName: 'piece',
    calPer100g: 350,
    proteinPer100g: 7.5,
    carbsPer100g: 48.0,
    fatPer100g: 14.5,
    fiberPer100g: 2.2,
  },

  // Dals & Curries
  {
    canonicalName: 'Dal Tadka',
    aliases: ['dal tadka', 'yellow dal', 'daal', 'dal', 'toor dal', 'moong dal', 'lentil curry'],
    defaultPortionG: 180,
    defaultUnitName: 'katori',
    calPer100g: 90,
    proteinPer100g: 4.8,
    carbsPer100g: 12.5,
    fatPer100g: 2.8,
    fiberPer100g: 2.5,
  },
  {
    canonicalName: 'Dal Makhani',
    aliases: ['dal makhani', 'daal makhni', 'makhani dal', 'black dal', 'maa ki dal'],
    defaultPortionG: 180,
    defaultUnitName: 'katori',
    calPer100g: 155,
    proteinPer100g: 5.5,
    carbsPer100g: 14.0,
    fatPer100g: 8.5,
    fiberPer100g: 3.5,
  },
  {
    canonicalName: 'Chole Bhature',
    aliases: ['chole bhature', 'chana bhatura', 'chole bhatura', 'chhole bhature'],
    defaultPortionG: 280,
    defaultUnitName: 'plate',
    calPer100g: 240,
    proteinPer100g: 6.8,
    carbsPer100g: 28.0,
    fatPer100g: 11.5,
    fiberPer100g: 3.5,
  },
  {
    canonicalName: 'Chole Masala',
    aliases: ['chole masala', 'chana masala', 'chhole masala', 'chole', 'chana', 'chhole'],
    defaultPortionG: 180,
    defaultUnitName: 'katori',
    calPer100g: 145,
    proteinPer100g: 6.5,
    carbsPer100g: 19.0,
    fatPer100g: 5.0,
    fiberPer100g: 4.5,
  },
  {
    canonicalName: 'Rajma Masala',
    aliases: ['rajma', 'rajmah', 'red kidney beans', 'rajma chawal'],
    defaultPortionG: 180,
    defaultUnitName: 'katori',
    calPer100g: 130,
    proteinPer100g: 6.8,
    carbsPer100g: 18.0,
    fatPer100g: 3.5,
    fiberPer100g: 5.0,
  },
  {
    canonicalName: 'Sambar',
    aliases: ['sambar', 'sambhar'],
    defaultPortionG: 180,
    defaultUnitName: 'katori',
    calPer100g: 70,
    proteinPer100g: 3.2,
    carbsPer100g: 10.5,
    fatPer100g: 1.8,
    fiberPer100g: 2.2,
  },

  // Paneer & Vegetarian Dishes
  {
    canonicalName: 'Paneer Butter Masala',
    aliases: ['paneer butter masala', 'paneer makhani', 'butter paneer'],
    defaultPortionG: 200,
    defaultUnitName: 'katori',
    calPer100g: 180,
    proteinPer100g: 7.5,
    carbsPer100g: 7.0,
    fatPer100g: 14.0,
    fiberPer100g: 1.8,
  },
  {
    canonicalName: 'Palak Paneer',
    aliases: ['palak paneer', 'spinach paneer', 'saag paneer'],
    defaultPortionG: 200,
    defaultUnitName: 'katori',
    calPer100g: 140,
    proteinPer100g: 7.0,
    carbsPer100g: 5.5,
    fatPer100g: 10.5,
    fiberPer100g: 2.8,
  },
  {
    canonicalName: 'Kadai Paneer',
    aliases: ['kadai paneer', 'karahi paneer', 'paneer kadai'],
    defaultPortionG: 200,
    defaultUnitName: 'katori',
    calPer100g: 165,
    proteinPer100g: 8.0,
    carbsPer100g: 6.5,
    fatPer100g: 12.0,
    fiberPer100g: 2.2,
  },
  {
    canonicalName: 'Pav Bhaji',
    aliases: ['pav bhaji', 'bhaji', 'pao bhaji'],
    defaultPortionG: 220,
    defaultUnitName: 'plate',
    calPer100g: 135,
    proteinPer100g: 3.8,
    carbsPer100g: 18.0,
    fatPer100g: 5.5,
    fiberPer100g: 3.0,
  },

  // Rice & Biryani
  {
    canonicalName: 'Steamed White Rice',
    aliases: ['rice', 'white rice', 'steamed rice', 'chawal', 'cooked rice', 'plain rice', 'boiled rice'],
    defaultPortionG: 160,
    defaultUnitName: 'cup',
    calPer100g: 130,
    proteinPer100g: 2.7,
    carbsPer100g: 28.2,
    fatPer100g: 0.3,
    fiberPer100g: 0.4,
  },
  {
    canonicalName: 'Brown Rice',
    aliases: ['brown rice', 'cooked brown rice'],
    defaultPortionG: 160,
    defaultUnitName: 'cup',
    calPer100g: 111,
    proteinPer100g: 2.6,
    carbsPer100g: 23.0,
    fatPer100g: 0.9,
    fiberPer100g: 1.8,
  },
  {
    canonicalName: 'Chicken Biryani',
    aliases: ['chicken biryani', 'biryani', 'biriyani', 'mutton biryani'],
    defaultPortionG: 250,
    defaultUnitName: 'plate',
    calPer100g: 180,
    proteinPer100g: 9.5,
    carbsPer100g: 22.0,
    fatPer100g: 6.0,
    fiberPer100g: 1.2,
  },
  {
    canonicalName: 'Vegetable Pulao',
    aliases: ['veg pulao', 'vegetable pulao', 'pulao', 'pilaf', 'peas pulao', 'jeera rice'],
    defaultPortionG: 200,
    defaultUnitName: 'plate',
    calPer100g: 145,
    proteinPer100g: 3.5,
    carbsPer100g: 26.0,
    fatPer100g: 3.0,
    fiberPer100g: 1.5,
  },
  {
    canonicalName: 'Fried Rice',
    aliases: ['fried rice', 'egg fried rice', 'veg fried rice'],
    defaultPortionG: 200,
    defaultUnitName: 'plate',
    calPer100g: 165,
    proteinPer100g: 4.5,
    carbsPer100g: 27.0,
    fatPer100g: 4.5,
    fiberPer100g: 1.2,
  },

  // South Indian Breakfast
  {
    canonicalName: 'Idli',
    aliases: ['idli', 'idlis', 'steamed idli'],
    defaultPortionG: 45,
    defaultUnitName: 'piece',
    calPer100g: 135,
    proteinPer100g: 4.2,
    carbsPer100g: 28.0,
    fatPer100g: 0.5,
    fiberPer100g: 1.5,
  },
  {
    canonicalName: 'Plain Dosa',
    aliases: ['dosa', 'dosas', 'plain dosa', 'sada dosa'],
    defaultPortionG: 90,
    defaultUnitName: 'piece',
    calPer100g: 170,
    proteinPer100g: 4.5,
    carbsPer100g: 29.0,
    fatPer100g: 4.0,
    fiberPer100g: 1.8,
  },
  {
    canonicalName: 'Masala Dosa',
    aliases: ['masala dosa', 'mysore masala dosa'],
    defaultPortionG: 160,
    defaultUnitName: 'piece',
    calPer100g: 195,
    proteinPer100g: 4.2,
    carbsPer100g: 31.0,
    fatPer100g: 6.0,
    fiberPer100g: 2.2,
  },
  {
    canonicalName: 'Medu Vada',
    aliases: ['vada', 'vadas', 'medu vada', 'medu vadai', 'sambar vada'],
    defaultPortionG: 50,
    defaultUnitName: 'piece',
    calPer100g: 275,
    proteinPer100g: 7.5,
    carbsPer100g: 27.0,
    fatPer100g: 15.0,
    fiberPer100g: 3.5,
  },

  // Snacks & Indian Fast Food
  {
    canonicalName: 'Samosa',
    aliases: ['samosa', 'samosas', 'samose', 'aloo samosa'],
    defaultPortionG: 85,
    defaultUnitName: 'piece',
    calPer100g: 310,
    proteinPer100g: 4.5,
    carbsPer100g: 36.0,
    fatPer100g: 16.5,
    fiberPer100g: 2.8,
  },
  {
    canonicalName: 'Pakora',
    aliases: ['pakora', 'pakoras', 'pakode', 'bhajia', 'onion pakora', 'paneer pakora'],
    defaultPortionG: 30,
    defaultUnitName: 'piece',
    calPer100g: 290,
    proteinPer100g: 6.0,
    carbsPer100g: 28.0,
    fatPer100g: 17.0,
    fiberPer100g: 3.0,
  },
  {
    canonicalName: 'Dhokla',
    aliases: ['dhokla', 'khaman', 'khaman dhokla'],
    defaultPortionG: 40,
    defaultUnitName: 'piece',
    calPer100g: 160,
    proteinPer100g: 6.5,
    carbsPer100g: 24.0,
    fatPer100g: 4.0,
    fiberPer100g: 2.5,
  },
  {
    canonicalName: 'Pani Puri',
    aliases: ['pani puri', 'paani puri', 'golgappa', 'golgappe', 'puchka'],
    defaultPortionG: 20,
    defaultUnitName: 'piece',
    calPer100g: 175,
    proteinPer100g: 3.0,
    carbsPer100g: 32.0,
    fatPer100g: 4.0,
    fiberPer100g: 2.0,
  },
  {
    canonicalName: 'Kathi Roll',
    aliases: ['kathi roll', 'kaathi rolls', 'chicken roll', 'paneer roll', 'egg roll'],
    defaultPortionG: 180,
    defaultUnitName: 'piece',
    calPer100g: 230,
    proteinPer100g: 9.5,
    carbsPer100g: 28.0,
    fatPer100g: 9.0,
    fiberPer100g: 2.0,
  },
  {
    canonicalName: 'Momos',
    aliases: ['momos', 'momo', 'dim sum', 'dumplings'],
    defaultPortionG: 30,
    defaultUnitName: 'piece',
    calPer100g: 180,
    proteinPer100g: 6.5,
    carbsPer100g: 26.0,
    fatPer100g: 5.5,
    fiberPer100g: 1.5,
  },

  // Non-Veg Proteins
  {
    canonicalName: 'Chicken Curry',
    aliases: ['chicken curry', 'chicken masala', 'butter chicken', 'murgh'],
    defaultPortionG: 200,
    defaultUnitName: 'katori',
    calPer100g: 165,
    proteinPer100g: 14.5,
    carbsPer100g: 4.0,
    fatPer100g: 10.0,
    fiberPer100g: 1.0,
  },
  {
    canonicalName: 'Boiled Egg',
    aliases: ['boiled egg', 'boiled eggs', 'hard boiled egg', 'egg', 'eggs', 'anda', 'ande'],
    defaultPortionG: 50,
    defaultUnitName: 'piece',
    calPer100g: 155,
    proteinPer100g: 12.6,
    carbsPer100g: 1.1,
    fatPer100g: 10.6,
    fiberPer100g: 0.0,
  },
  {
    canonicalName: 'Egg Omelette',
    aliases: ['omelette', 'omelet', 'egg omelette', 'masala omelette'],
    defaultPortionG: 90,
    defaultUnitName: 'serving',
    calPer100g: 160,
    proteinPer100g: 11.0,
    carbsPer100g: 2.0,
    fatPer100g: 12.0,
    fiberPer100g: 0.5,
  },

  // Beverages & Dairy
  {
    canonicalName: 'Masala Chai',
    aliases: ['chai', 'tea', 'masala chai', 'milk tea', 'cutting chai'],
    defaultPortionG: 150,
    defaultUnitName: 'cup',
    calPer100g: 60,
    proteinPer100g: 2.0,
    carbsPer100g: 8.0,
    fatPer100g: 2.2,
    fiberPer100g: 0.0,
  },
  {
    canonicalName: 'Sweet Lassi',
    aliases: ['lassi', 'sweet lassi', 'mango lassi', 'curd drink'],
    defaultPortionG: 240,
    defaultUnitName: 'glass',
    calPer100g: 88,
    proteinPer100g: 2.5,
    carbsPer100g: 13.5,
    fatPer100g: 2.8,
    fiberPer100g: 0.0,
  },
  {
    canonicalName: 'Chaas (Buttermilk)',
    aliases: ['chaas', 'buttermilk', 'chach', 'masala chaas'],
    defaultPortionG: 220,
    defaultUnitName: 'glass',
    calPer100g: 35,
    proteinPer100g: 1.8,
    carbsPer100g: 2.5,
    fatPer100g: 1.6,
    fiberPer100g: 0.0,
  },
  {
    canonicalName: 'Whole Milk',
    aliases: ['milk', 'whole milk', 'doodh', 'cow milk'],
    defaultPortionG: 240,
    defaultUnitName: 'glass',
    calPer100g: 62,
    proteinPer100g: 3.2,
    carbsPer100g: 4.8,
    fatPer100g: 3.3,
    fiberPer100g: 0.0,
  },
  {
    canonicalName: 'Plain Curd (Dahi)',
    aliases: ['curd', 'dahi', 'yogurt', 'plain yogurt'],
    defaultPortionG: 150,
    defaultUnitName: 'katori',
    calPer100g: 61,
    proteinPer100g: 3.5,
    carbsPer100g: 4.7,
    fatPer100g: 3.3,
    fiberPer100g: 0.0,
  },

  // Sweets
  {
    canonicalName: 'Jalebi',
    aliases: ['jalebi', 'jalebis', 'imarti'],
    defaultPortionG: 50,
    defaultUnitName: 'piece',
    calPer100g: 380,
    proteinPer100g: 2.5,
    carbsPer100g: 78.0,
    fatPer100g: 8.0,
    fiberPer100g: 0.5,
  },
  {
    canonicalName: 'Kulfi',
    aliases: ['kulfi', 'matka kulfi', 'pista kulfi'],
    defaultPortionG: 80,
    defaultUnitName: 'piece',
    calPer100g: 230,
    proteinPer100g: 4.5,
    carbsPer100g: 26.0,
    fatPer100g: 12.0,
    fiberPer100g: 0.2,
  },

  // Western Staples
  {
    canonicalName: 'Apple',
    aliases: ['apple', 'apples', 'seb'],
    defaultPortionG: 180,
    defaultUnitName: 'piece',
    calPer100g: 52,
    proteinPer100g: 0.3,
    carbsPer100g: 13.8,
    fatPer100g: 0.2,
    fiberPer100g: 2.4,
  },
  {
    canonicalName: 'Banana',
    aliases: ['banana', 'bananas', 'kela', 'kele'],
    defaultPortionG: 118,
    defaultUnitName: 'piece',
    calPer100g: 89,
    proteinPer100g: 1.1,
    carbsPer100g: 22.8,
    fatPer100g: 0.3,
    fiberPer100g: 2.6,
  },
  {
    canonicalName: 'Oatmeal (Cooked)',
    aliases: ['oatmeal', 'oats', 'porridge'],
    defaultPortionG: 230,
    defaultUnitName: 'bowl',
    calPer100g: 71,
    proteinPer100g: 2.5,
    carbsPer100g: 12.0,
    fatPer100g: 1.5,
    fiberPer100g: 1.7,
  },
  {
    canonicalName: 'Burger',
    aliases: ['burger', 'cheeseburger', 'veg burger', 'chicken burger'],
    defaultPortionG: 180,
    defaultUnitName: 'piece',
    calPer100g: 250,
    proteinPer100g: 12.0,
    carbsPer100g: 26.0,
    fatPer100g: 11.0,
    fiberPer100g: 1.5,
  },
  {
    canonicalName: 'French Fries',
    aliases: ['fries', 'french fries', 'potato fries'],
    defaultPortionG: 115,
    defaultUnitName: 'serving',
    calPer100g: 312,
    proteinPer100g: 3.4,
    carbsPer100g: 41.0,
    fatPer100g: 15.0,
    fiberPer100g: 3.8,
  },
  {
    canonicalName: 'Pizza Slice',
    aliases: ['pizza', 'pizza slice', 'margherita pizza'],
    defaultPortionG: 105,
    defaultUnitName: 'slice',
    calPer100g: 266,
    proteinPer100g: 11.0,
    carbsPer100g: 33.0,
    fatPer100g: 10.0,
    fiberPer100g: 2.3,
  },
  {
    canonicalName: 'Sandwich',
    aliases: ['sandwich', 'sandwiches', 'veg sandwich', 'grilled sandwich'],
    defaultPortionG: 150,
    defaultUnitName: 'piece',
    calPer100g: 220,
    proteinPer100g: 7.5,
    carbsPer100g: 28.0,
    fatPer100g: 8.5,
    fiberPer100g: 2.0,
  },
];

// Sort aliases by length descending so longer phrases match first
const SORTED_FOOD_LOOKUP: Array<{ alias: string; food: FoodDefinition }> = [];
for (const food of FOOD_CATALOG) {
  for (const alias of food.aliases) {
    SORTED_FOOD_LOOKUP.push({ alias: alias.toLowerCase(), food });
  }
}
SORTED_FOOD_LOOKUP.sort((a, b) => b.alias.length - a.alias.length);

// ─── 4. Grammar Parsing Core ────────────────────────────────────────────────

/**
 * Splits input text into discrete clauses using common conjunctions and punctuation.
 */
function splitClauses(text: string): string[] {
  // Normalize punctuation and conjunction words
  const normalized = text
    .replace(/[,\.;\+]/g, ' and ')
    .replace(/\b(aur|with|along with|plus|saath|and then|then)\b/gi, ' and ')
    .toLowerCase();

  return normalized
    .split(/\band\b/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Parses quantity from a single clause: handles digits, decimals, fractions, and Hinglish words.
 */
function extractQuantityAndUnit(clause: string): { quantity: number; unit?: UnitDef; unitWord?: string; remainingText: string } {
  let cleaned = clause.trim();
  let quantity = 1;
  let unit: UnitDef | undefined;
  let unitWord: string | undefined;

  // 1. Check for explicit gram weights like "150g" or "200 gm" or "250 ml"
  const gramMatch = cleaned.match(/\b(\d+(?:\.\d+)?)\s*(?:g|gm|gms|grams?|ml|milliliters?)\b/i);
  if (gramMatch) {
    const rawNum = parseFloat(gramMatch[1]);
    cleaned = cleaned.replace(gramMatch[0], ' ').trim();
    return {
      quantity: rawNum,
      unit: { multiplierG: 1, label: 'g' },
      unitWord: 'g',
      remainingText: cleaned,
    };
  }

  // 2. Look for numeric digits or decimal (e.g. "2", "1.5", "0.5")
  const numDigitMatch = cleaned.match(/\b(\d+(?:\.\d+)?)\b/);
  if (numDigitMatch) {
    quantity = parseFloat(numDigitMatch[1]);
    cleaned = cleaned.replace(numDigitMatch[0], ' ').trim();
  } else {
    // Check for word numbers
    for (const [word, val] of Object.entries(NUMBER_MAP)) {
      const reg = new RegExp(`\\b${word}\\b`, 'i');
      if (reg.test(cleaned)) {
        quantity = val;
        cleaned = cleaned.replace(reg, ' ').trim();
        break;
      }
    }
  }

  // 3. Look for unit words (e.g. "katori", "bowl", "glass", "cup", "plate", "slice")
  for (const [uWord, uDef] of Object.entries(UNIT_MAP)) {
    const uReg = new RegExp(`\\b${uWord}\\b`, 'i');
    if (uReg.test(cleaned)) {
      unit = uDef;
      unitWord = uWord;
      cleaned = cleaned.replace(uReg, ' ').trim();
      break;
    }
  }

  // Remove filler prepositions like "of", "a", "an", "the", "ki", "ka"
  cleaned = cleaned.replace(/\b(of|a|an|the|ki|ka|se|with)\b/gi, ' ').replace(/\s+/g, ' ').trim();

  return {
    quantity,
    unit,
    unitWord,
    remainingText: cleaned,
  };
}

/**
 * Matches food name against the sorted alias catalog.
 */
function matchFoodFromCatalog(text: string): { food?: FoodDefinition; matchedAlias?: string } {
  const norm = text.toLowerCase().trim();
  if (!norm) return {};

  for (const item of SORTED_FOOD_LOOKUP) {
    const reg = new RegExp(`\\b${item.alias}\\b`, 'i');
    if (reg.test(norm)) {
      return { food: item.food, matchedAlias: item.alias };
    }
  }

  // Fallback substring check
  for (const item of SORTED_FOOD_LOOKUP) {
    if (norm.includes(item.alias)) {
      return { food: item.food, matchedAlias: item.alias };
    }
  }

  return {};
}

/**
 * Main parser entry point: parses transcript into structured items with calculated nutrition.
 */
export function parseSpokenMealGrammar(transcript: string): ParsedMealItem[] {
  const clauses = splitClauses(transcript);
  const results: ParsedMealItem[] = [];

  for (const clause of clauses) {
    const { quantity, unit, unitWord, remainingText } = extractQuantityAndUnit(clause);
    const { food, matchedAlias } = matchFoodFromCatalog(remainingText || clause);

    if (food) {
      // Calculate portion in grams
      let portionG = 0;
      let portionLabel = '';

      if (unit) {
        if (unit.label === 'g') {
          portionG = Math.round(quantity);
          portionLabel = `${portionG}g`;
        } else {
          portionG = Math.round(quantity * unit.multiplierG);
          portionLabel = `${quantity} ${unit.label} (${portionG}g)`;
        }
      } else {
        portionG = Math.round(quantity * food.defaultPortionG);
        const uName = quantity === 1 ? food.defaultUnitName : `${food.defaultUnitName}s`;
        portionLabel = `${quantity} ${uName} (${portionG}g)`;
      }

      const factor = portionG / 100.0;
      results.push({
        name: food.canonicalName,
        matchedFoodKey: matchedAlias || food.canonicalName,
        portionG,
        portionLabel,
        calories: Math.round(food.calPer100g * factor),
        proteinG: parseFloat((food.proteinPer100g * factor).toFixed(1)),
        carbsG: parseFloat((food.carbsPer100g * factor).toFixed(1)),
        fatG: parseFloat((food.fatPer100g * factor).toFixed(1)),
        fiberG: parseFloat((food.fiberPer100g * factor).toFixed(1)),
        confidence: 0.95,
        isAiEstimate: false,
      });
    } else if (remainingText && remainingText.length > 1) {
      // Unrecognized dish fallback: assign sensible generic serving
      const mult = unit ? unit.multiplierG : 150;
      const portionG = Math.round(quantity * mult);
      const cleanName = remainingText
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

      results.push({
        name: cleanName,
        matchedFoodKey: remainingText,
        portionG,
        portionLabel: `${quantity} ${unit ? unit.label : 'serving'} (${portionG}g)`,
        calories: Math.round(150 * (portionG / 100)),
        proteinG: parseFloat((6.0 * (portionG / 100)).toFixed(1)),
        carbsG: parseFloat((20.0 * (portionG / 100)).toFixed(1)),
        fatG: parseFloat((5.0 * (portionG / 100)).toFixed(1)),
        fiberG: parseFloat((2.0 * (portionG / 100)).toFixed(1)),
        confidence: 0.80,
        isAiEstimate: true,
      });
    }
  }

  return results;
}
