/**
 * Automated Test Suite for Deterministic Voice Meal Grammar Parser
 * Verifies 32 real-world spoken English, Hindi, and Hinglish sentences.
 */

import { parseSpokenMealGrammar } from './services/voiceMealGrammarParser.js';

interface TestCase {
  phrase: string;
  expectedMinItems: number;
  expectedItems: string[];
}

const TEST_CASES: TestCase[] = [
  {
    phrase: 'Two chapatis with a bowl of dal tadka',
    expectedMinItems: 2,
    expectedItems: ['Whole Wheat Roti', 'Dal Tadka'],
  },
  {
    phrase: 'Do roti aur ek katori dal',
    expectedMinItems: 2,
    expectedItems: ['Whole Wheat Roti', 'Dal Tadka'],
  },
  {
    phrase: 'Ek plate chicken biryani',
    expectedMinItems: 1,
    expectedItems: ['Chicken Biryani'],
  },
  {
    phrase: 'Three rotis with palak paneer',
    expectedMinItems: 2,
    expectedItems: ['Whole Wheat Roti', 'Palak Paneer'],
  },
  {
    phrase: 'Two boiled eggs and a glass of milk',
    expectedMinItems: 2,
    expectedItems: ['Boiled Egg', 'Whole Milk'],
  },
  {
    phrase: 'Do boiled eggs aur ek cup chai',
    expectedMinItems: 2,
    expectedItems: ['Boiled Egg', 'Masala Chai'],
  },
  {
    phrase: 'A plate of pav bhaji with one butter naan',
    expectedMinItems: 2,
    expectedItems: ['Pav Bhaji', 'Butter Naan'],
  },
  {
    phrase: 'One masala dosa and two medu vadas',
    expectedMinItems: 2,
    expectedItems: ['Masala Dosa', 'Medu Vada'],
  },
  {
    phrase: 'Aadha cup white rice aur ek katori sambar',
    expectedMinItems: 2,
    expectedItems: ['Steamed White Rice', 'Sambar'],
  },
  {
    phrase: 'Two samosas with one sweet lassi',
    expectedMinItems: 2,
    expectedItems: ['Samosa', 'Sweet Lassi'],
  },
  {
    phrase: 'Ek glass chaas aur do parathas',
    expectedMinItems: 2,
    expectedItems: ['Chaas (Buttermilk)', 'Plain Paratha'],
  },
  {
    phrase: 'Three aloo parathas',
    expectedMinItems: 1,
    expectedItems: ['Aloo Paratha'],
  },
  {
    phrase: 'One bowl oatmeal and one banana',
    expectedMinItems: 2,
    expectedItems: ['Oatmeal (Cooked)', 'Banana'],
  },
  {
    phrase: 'Ek katori curd aur do chapati',
    expectedMinItems: 2,
    expectedItems: ['Plain Curd (Dahi)', 'Whole Wheat Roti'],
  },
  {
    phrase: 'A burger with french fries',
    expectedMinItems: 2,
    expectedItems: ['Burger', 'French Fries'],
  },
  {
    phrase: 'Two slices of pizza',
    expectedMinItems: 1,
    expectedItems: ['Pizza Slice'],
  },
  {
    phrase: 'Four momos aur ek plate fried rice',
    expectedMinItems: 2,
    expectedItems: ['Momos', 'Fried Rice'],
  },
  {
    phrase: 'Ek plate chole bhature',
    expectedMinItems: 1,
    expectedItems: ['Chole Bhature'],
  },
  {
    phrase: 'Dedh cup brown rice with chicken curry',
    expectedMinItems: 2,
    expectedItems: ['Brown Rice', 'Chicken Curry'],
  },
  {
    phrase: 'Dhai rotis with yellow dal',
    expectedMinItems: 2,
    expectedItems: ['Whole Wheat Roti', 'Dal Tadka'],
  },
  {
    phrase: 'Six pani puri',
    expectedMinItems: 1,
    expectedItems: ['Pani Puri'],
  },
  {
    phrase: 'Ek piece dhokla aur do pakode',
    expectedMinItems: 2,
    expectedItems: ['Dhokla', 'Pakora'],
  },
  {
    phrase: 'Two jalebis and one kulfi',
    expectedMinItems: 2,
    expectedItems: ['Jalebi', 'Kulfi'],
  },
  {
    phrase: 'One apple and one boiled egg',
    expectedMinItems: 2,
    expectedItems: ['Apple', 'Boiled Egg'],
  },
  {
    phrase: 'Do katori dal makhani with two butter naan',
    expectedMinItems: 2,
    expectedItems: ['Dal Makhani', 'Butter Naan'],
  },
  {
    phrase: 'Ek katori kadai paneer aur teen phulkas',
    expectedMinItems: 2,
    expectedItems: ['Kadai Paneer', 'Whole Wheat Roti'],
  },
  {
    phrase: '150g white rice and 200g chicken curry',
    expectedMinItems: 2,
    expectedItems: ['Steamed White Rice', 'Chicken Curry'],
  },
  {
    phrase: 'One egg omelette with two slices of bread',
    expectedMinItems: 1,
    expectedItems: ['Egg Omelette'],
  },
  {
    phrase: 'Ek cup cutting chai with one samosa',
    expectedMinItems: 2,
    expectedItems: ['Masala Chai', 'Samosa'],
  },
  {
    phrase: 'Four idlis with sambar',
    expectedMinItems: 2,
    expectedItems: ['Idli', 'Sambar'],
  },
  {
    phrase: 'Ek plate veg pulao aur ek glass lassi',
    expectedMinItems: 2,
    expectedItems: ['Vegetable Pulao', 'Sweet Lassi'],
  },
  {
    phrase: 'Two parathas with a bowl of curd',
    expectedMinItems: 2,
    expectedItems: ['Plain Paratha', 'Plain Curd (Dahi)'],
  },
];

export async function runVoiceParserTests(): Promise<boolean> {
  console.log('\n=============================================================');
  console.log('🧪 RUNNING DETERMINISTIC VOICE & HINGLISH PARSER TEST SUITE');
  console.log(`Total Test Cases: ${TEST_CASES.length}`);
  console.log('=============================================================\n');

  let passed = 0;
  let failed = 0;

  for (let i = 0; i < TEST_CASES.length; i++) {
    const tc = TEST_CASES[i];
    const parsed = parseSpokenMealGrammar(tc.phrase);

    const hasMinItems = parsed.length >= tc.expectedMinItems;
    const itemNames = parsed.map((p) => p.name);
    const containsExpected = tc.expectedItems.every((exp) => itemNames.includes(exp));

    if (hasMinItems && containsExpected) {
      passed++;
      const summary = parsed.map((p) => `${p.portionLabel} of ${p.name} (${p.calories} kcal)`).join(', ');
      console.log(`  ✅ Test #${i + 1} PASSED: "${tc.phrase}" -> [${summary}]`);
    } else {
      failed++;
      console.error(`  ❌ Test #${i + 1} FAILED: "${tc.phrase}"`);
      console.error(`     Expected items: ${JSON.stringify(tc.expectedItems)}`);
      console.error(`     Got: ${JSON.stringify(itemNames)}`);
    }
  }

  console.log('\n-------------------------------------------------------------');
  console.log(`Summary: ${passed} passed, ${failed} failed (${((passed / TEST_CASES.length) * 100).toFixed(1)}% success rate)`);
  console.log('-------------------------------------------------------------\n');

  return failed === 0;
}

if (process.argv[1] && process.argv[1].endsWith('test-voice-parser.ts')) {
  runVoiceParserTests().then((ok) => {
    process.exit(ok ? 0 : 1);
  });
}
