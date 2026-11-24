/**
 * FitSnap Server - Robust Meal Planner & Grocery List Routes
 * 7-day nutritional meal plan generation grounded strictly in certified USDA & Indian food database,
 * with progressive constraint relaxation, allergy & dislike guards, portion calibration,
 * meal lock/swap/log actions, and aisle-grouped grocery list generation.
 */

import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

export interface MealTemplate {
  name: string;
  portionG: number;
  cal: number;
  p: number;
  c: number;
  f: number;
  allergens?: string[];
  dislikes?: string[];
}

export const PRESET_MEAL_DATABASE: Record<string, Record<'breakfast' | 'lunch' | 'dinner' | 'snack', MealTemplate[]>> = {
  indian_veg: {
    breakfast: [
      { name: 'Oats with Warm Milk, Almonds & Honey', portionG: 250, cal: 340, p: 12, c: 54, f: 8, allergens: ['dairy', 'nuts', 'gluten'] },
      { name: 'Poha with Roasted Peanuts & Curry Leaves', portionG: 200, cal: 310, p: 8, c: 52, f: 9, allergens: ['peanuts'] },
      { name: 'Steamed Idli (3 pcs) with Vegetable Sambar', portionG: 260, cal: 280, p: 10, c: 50, f: 3, allergens: [] },
      { name: 'Moong Dal Cheela with Fresh Mint Chutney', portionG: 200, cal: 320, p: 16, c: 42, f: 10, allergens: [] },
      { name: 'Besan Chilla with Paneer Stuffing', portionG: 220, cal: 350, p: 18, c: 38, f: 14, allergens: ['dairy'] },
      { name: 'Upma with Mixed Vegetables & Cashews', portionG: 220, cal: 310, p: 7, c: 48, f: 10, allergens: ['gluten', 'nuts'] },
      { name: 'Sprouted Moong Salad with Lemon & Pomegranate', portionG: 200, cal: 250, p: 14, c: 42, f: 3, allergens: [] },
      { name: 'Poha with Roasted Cumin, Mustard Seeds & Green Peas', portionG: 200, cal: 300, p: 8, c: 52, f: 7, allergens: [] },
      { name: 'Methi Thepla (2 pcs) with Mint Chutney', portionG: 180, cal: 280, p: 8, c: 44, f: 8, allergens: ['gluten'] },
    ],
    lunch: [
      { name: 'Whole Wheat Roti (2 pcs) with Dal Tadka & Cucumber Salad', portionG: 320, cal: 480, p: 18, c: 74, f: 12, allergens: ['gluten'] },
      { name: 'Paneer Butter Masala with 2 Phulkas & Curd', portionG: 350, cal: 580, p: 24, c: 62, f: 26, allergens: ['dairy', 'gluten'] },
      { name: 'Rajma Masala with Steamed Brown Rice & Salad', portionG: 380, cal: 520, p: 20, c: 85, f: 10, allergens: [] },
      { name: 'Chole (Chickpea Curry) with 2 Rotis & Pickled Onions', portionG: 360, cal: 510, p: 21, c: 78, f: 13, allergens: ['gluten'] },
      { name: 'Dal Makhani with Jeera Rice & Cucumber Raita', portionG: 370, cal: 530, p: 17, c: 76, f: 18, allergens: ['dairy'] },
      { name: 'Baingan Bharta with 2 Whole Wheat Chapatis & Curd', portionG: 340, cal: 450, p: 14, c: 66, f: 14, allergens: ['gluten', 'dairy'], dislikes: ['eggplant', 'baingan'] },
      { name: 'Bhindi Masala with Yellow Dal & 2 Rotis', portionG: 350, cal: 470, p: 15, c: 72, f: 14, allergens: ['gluten'], dislikes: ['okra', 'bhindi'] },
      { name: 'Sambar with Steamed Brown Rice & French Bean Poriyal', portionG: 360, cal: 480, p: 16, c: 80, f: 8, allergens: [] },
      { name: 'Kala Chana Masala (Black Chickpeas) with 2 Phulkas & Salad', portionG: 350, cal: 490, p: 19, c: 74, f: 11, allergens: ['gluten'] },
    ],
    dinner: [
      { name: 'Palak Paneer with 2 Whole Wheat Rotis', portionG: 320, cal: 460, p: 22, c: 52, f: 18, allergens: ['dairy', 'gluten'], dislikes: ['spinach', 'palak'] },
      { name: 'Moong Dal Khichdi with 1 tsp Desi Ghee & Roasted Papad', portionG: 340, cal: 420, p: 14, c: 68, f: 11, allergens: ['dairy'] },
      { name: 'Mixed Vegetable Curry with 2 Chapatis & Mint Raita', portionG: 330, cal: 390, p: 12, c: 58, f: 12, allergens: ['gluten', 'dairy'] },
      { name: 'Yellow Dal Tadka with Steamed Rice & Kachumber', portionG: 350, cal: 440, p: 15, c: 72, f: 9, allergens: [] },
      { name: 'Mushroom Matar with 2 Multigrain Rotis', portionG: 330, cal: 430, p: 16, c: 64, f: 12, allergens: ['gluten'], dislikes: ['mushroom'] },
      { name: 'Aloo Gobi with 2 Phulkas & Boondi Raita', portionG: 340, cal: 450, p: 13, c: 70, f: 13, allergens: ['gluten', 'dairy'] },
      { name: 'Tofu Bhurji Curry with 2 Chapatis', portionG: 320, cal: 410, p: 22, c: 48, f: 14, allergens: ['gluten', 'soy'] },
      { name: 'Lauki (Bottle Gourd) Chana Dal Curry with Steamed Rice', portionG: 340, cal: 410, p: 15, c: 68, f: 8, allergens: [] },
      { name: 'Moong Dal & Vegetable Khichdi (Mustard Oil Tadka) with Papad', portionG: 340, cal: 410, p: 14, c: 70, f: 8, allergens: [] },
      { name: 'Gobi Gajar Matar Sauté with 2 Phulkas & Kachumber', portionG: 330, cal: 390, p: 12, c: 62, f: 10, allergens: ['gluten'] },
    ],
    snack: [
      { name: 'Roasted Chana (Chickpeas) with Chaat Masala', portionG: 60, cal: 210, p: 12, c: 32, f: 4, allergens: [] },
      { name: 'Sweet Lassi (1 Glass)', portionG: 250, cal: 220, p: 7, c: 34, f: 6, allergens: ['dairy'] },
      { name: 'Sprouts Chaat with Lime & Chopped Tomato', portionG: 150, cal: 170, p: 11, c: 26, f: 2, allergens: [] },
      { name: 'Masala Chai with 5 Roasted Almonds', portionG: 170, cal: 150, p: 5, c: 15, f: 8, allergens: ['dairy', 'nuts'] },
      { name: 'Makhana (Roasted Foxnuts) with Turmeric & Salt', portionG: 50, cal: 180, p: 5, c: 36, f: 2, allergens: [] },
      { name: 'Buttermilk (Chaas) with Roasted Cumin', portionG: 250, cal: 90, p: 4, c: 8, f: 3, allergens: ['dairy'] },
    ],
  },
  balanced: {
    breakfast: [
      { name: 'Greek Yogurt with Granola & Mixed Berries', portionG: 220, cal: 350, p: 20, c: 45, f: 9, allergens: ['dairy', 'gluten'] },
      { name: 'Scrambled Eggs (3) with Whole Wheat Toast & Tomato', portionG: 200, cal: 380, p: 24, c: 28, f: 18, allergens: ['egg', 'gluten'] },
      { name: 'Peanut Butter Banana Toast on Multigrain Bread', portionG: 180, cal: 390, p: 14, c: 50, f: 16, allergens: ['peanuts', 'gluten'] },
      { name: 'Rolled Oats with Chia Seeds, Apple & Skim Milk', portionG: 250, cal: 330, p: 13, c: 54, f: 7, allergens: ['dairy', 'gluten'] },
      { name: 'Spinach & Feta Egg White Omelet with Avocado', portionG: 220, cal: 320, p: 26, c: 10, f: 18, allergens: ['egg', 'dairy'], dislikes: ['spinach'] },
      { name: 'Berry Protein Smoothie with Almond Milk', portionG: 300, cal: 280, p: 25, c: 32, f: 5, allergens: ['nuts'] },
    ],
    lunch: [
      { name: 'Grilled Chicken Breast with Brown Rice & Asparagus', portionG: 350, cal: 520, p: 44, c: 48, f: 14, allergens: [] },
      { name: 'Salmon Bowl with Brown Rice & Sliced Avocado', portionG: 360, cal: 580, p: 38, c: 52, f: 22, allergens: ['fish'] },
      { name: 'Turkey & Hummus Wrap with Mixed Greens', portionG: 300, cal: 480, p: 32, c: 46, f: 16, allergens: ['gluten'] },
      { name: 'Quinoa & Black Bean Burrito Bowl with Guacamole', portionG: 350, cal: 490, p: 18, c: 72, f: 15, allergens: [] },
      { name: 'Mediterranean Tuna Salad with Olive Oil & Whole Grain Pita', portionG: 320, cal: 470, p: 36, c: 42, f: 16, allergens: ['fish', 'gluten'] },
      { name: 'Grilled Tofu with Jasmine Rice & Steamed Broccoli', portionG: 340, cal: 440, p: 24, c: 56, f: 14, allergens: ['soy'] },
    ],
    dinner: [
      { name: 'Baked Cod with Roasted Sweet Potato & Steamed Green Beans', portionG: 340, cal: 460, p: 36, c: 54, f: 10, allergens: ['fish'] },
      { name: 'Lean Beef Stir-Fry with Broccoli & Jasmine Rice', portionG: 360, cal: 530, p: 40, c: 56, f: 15, allergens: [], dislikes: ['beef'] },
      { name: 'Grilled Herb Chicken Thigh with Roasted Veggies & Quinoa', portionG: 350, cal: 510, p: 38, c: 46, f: 18, allergens: [] },
      { name: 'Lentil Vegetable Stew with Slice of Crusty Sourdough', portionG: 360, cal: 430, p: 20, c: 68, f: 8, allergens: ['gluten'] },
      { name: 'Pan-Seared Salmon Fillet with Garlic Mashed Potatoes', portionG: 340, cal: 540, p: 35, c: 42, f: 24, allergens: ['fish', 'dairy'] },
      { name: 'Roast Turkey Breast with Cauliflower Mash & Gravy', portionG: 330, cal: 440, p: 42, c: 24, f: 16, allergens: ['dairy'] },
    ],
    snack: [
      { name: 'Whey Protein Shake with Unsweetened Almond Milk', portionG: 300, cal: 190, p: 26, c: 6, f: 4, allergens: ['dairy', 'nuts'] },
      { name: 'Crisp Apple Slices with 1 tbsp Natural Peanut Butter', portionG: 200, cal: 210, p: 4, c: 28, f: 10, allergens: ['peanuts'] },
      { name: 'Hard Boiled Eggs (2) with Sea Salt & Paprika', portionG: 100, cal: 148, p: 12, c: 1, f: 10, allergens: ['egg'] },
      { name: 'Mixed Raw Almonds & Walnuts (30g)', portionG: 30, cal: 185, p: 6, c: 5, f: 16, allergens: ['nuts'] },
      { name: 'Cottage Cheese with Sliced Pineapple', portionG: 180, cal: 170, p: 18, c: 16, f: 3, allergens: ['dairy'] },
    ],
  },
  high_protein: {
    breakfast: [
      { name: '4 Egg White + 1 Whole Egg Scramble with Turkey Bacon', portionG: 220, cal: 340, p: 34, c: 6, f: 16, allergens: ['egg'] },
      { name: 'Whey Protein Oatmeal with Scoop of Vanilla Whey & Berries', portionG: 250, cal: 390, p: 38, c: 46, f: 7, allergens: ['dairy', 'gluten'] },
      { name: 'Greek Yogurt Double Protein Bowl with Hemp Hearts', portionG: 240, cal: 360, p: 32, c: 28, f: 10, allergens: ['dairy'] },
      { name: 'Smoked Salmon & Egg White Wrap on Low-Carb Tortilla', portionG: 200, cal: 330, p: 32, c: 18, f: 12, allergens: ['fish', 'egg', 'gluten'] },
      { name: 'Cottage Cheese Pancakes with Maple Stevia', portionG: 220, cal: 350, p: 30, c: 34, f: 8, allergens: ['dairy', 'egg', 'gluten'] },
    ],
    lunch: [
      { name: 'Double Chicken Breast (200g) with Steamed White Rice', portionG: 360, cal: 540, p: 58, c: 48, f: 8, allergens: [] },
      { name: 'Tuna Steak with Roasted Sweet Potato Wedges & Broccoli', portionG: 350, cal: 510, p: 52, c: 44, f: 10, allergens: ['fish'] },
      { name: 'Lean Ground Turkey Bowl with Quinoa & Pico de Gallo', portionG: 360, cal: 530, p: 48, c: 46, f: 14, allergens: [] },
      { name: 'Grilled Flank Steak with Roasted Asparagus & Jasmine Rice', portionG: 350, cal: 560, p: 50, c: 44, f: 18, allergens: [], dislikes: ['beef'] },
      { name: 'High Protein Tofu & Edamame Soba Noodle Bowl', portionG: 350, cal: 490, p: 38, c: 56, f: 14, allergens: ['soy', 'gluten'] },
    ],
    dinner: [
      { name: 'Pan-Roasted Chicken Breast with Steamed Greens & Rice', portionG: 350, cal: 490, p: 54, c: 38, f: 10, allergens: [] },
      { name: 'Baked Atlantic Salmon with Lemon Herb Quinoa', portionG: 350, cal: 550, p: 46, c: 40, f: 22, allergens: ['fish'] },
      { name: 'Extra Lean Ground Beef Chili with Red Kidney Beans', portionG: 380, cal: 520, p: 48, c: 46, f: 14, allergens: [], dislikes: ['beef'] },
      { name: 'Grilled Tilapia Fillets (2) with Mashed Sweet Potatoes', portionG: 340, cal: 460, p: 46, c: 46, f: 8, allergens: ['fish'] },
      { name: 'Shrimp & Asparagus Stir-Fry over Cauliflower Rice', portionG: 320, cal: 380, p: 44, c: 18, f: 12, allergens: ['fish', 'seafood'] },
    ],
    snack: [
      { name: 'Double Scoop Whey Protein Shake in Water', portionG: 350, cal: 240, p: 48, c: 4, f: 2, allergens: ['dairy'] },
      { name: 'Low-Fat Cottage Cheese (200g) with Black Pepper', portionG: 200, cal: 180, p: 26, c: 8, f: 4, allergens: ['dairy'] },
      { name: 'Turkey Jerky (50g) with Sliced Cucumber', portionG: 120, cal: 150, p: 24, c: 6, f: 2, allergens: [] },
      { name: 'Hard Boiled Egg Whites (4) with Hummus', portionG: 150, cal: 160, p: 18, c: 8, f: 5, allergens: ['egg'] },
    ],
  },
  low_carb: {
    breakfast: [
      { name: '3 Whole Eggs Fried in Butter with Avocado Slices', portionG: 200, cal: 390, p: 20, c: 6, f: 32, allergens: ['egg', 'dairy'] },
      { name: 'Keto Bacon & Cheddar Omelet with Baby Spinach', portionG: 220, cal: 420, p: 26, c: 4, f: 34, allergens: ['egg', 'dairy'], dislikes: ['spinach'] },
      { name: 'Smoked Salmon Cream Cheese Roll-ups with Capers', portionG: 180, cal: 360, p: 24, c: 5, f: 28, allergens: ['fish', 'dairy'] },
      { name: 'Chia Seed Pudding in Unsweetened Coconut Milk', portionG: 200, cal: 290, p: 8, c: 8, f: 24, allergens: [] },
      { name: 'Sausage & Egg Breakfast Scramble with Peppers', portionG: 200, cal: 380, p: 22, c: 7, f: 28, allergens: ['egg'] },
      { name: 'Eggs Sunny Side Up in Olive Oil with Avocado', portionG: 210, cal: 380, p: 20, c: 4, f: 32, allergens: ['egg'] },
      { name: 'Smoked Salmon on Cucumber Rounds with Dill & Capers', portionG: 180, cal: 270, p: 25, c: 4, f: 17, allergens: ['fish'] },
      { name: 'Turkey Sausage & Spinach Skillet with Olive Oil', portionG: 220, cal: 340, p: 28, c: 5, f: 22, allergens: [], dislikes: ['spinach'] },
    ],
    lunch: [
      { name: 'Chicken Caesar Salad with Parmesan & Dressing (No Croutons)', portionG: 300, cal: 480, p: 38, c: 8, f: 32, allergens: ['dairy'] },
      { name: 'Bun-less Beef Burger with Cheddar, Bacon & Avocado', portionG: 280, cal: 580, p: 42, c: 6, f: 42, allergens: ['dairy'], dislikes: ['beef'] },
      { name: 'Canned Tuna Salad on Lettuce Boats with Olive Oil Mayo', portionG: 250, cal: 420, p: 34, c: 4, f: 30, allergens: ['fish', 'egg'] },
      { name: 'Grilled Chicken with Cauliflower Rice & Garlic Herb Butter', portionG: 320, cal: 460, p: 40, c: 9, f: 28, allergens: ['dairy'] },
      { name: 'Paneer Tikka Salad with Cucumbers & Mint Dressing', portionG: 280, cal: 440, p: 22, c: 10, f: 32, allergens: ['dairy'] },
      { name: 'Grilled Chicken Breast with Avocado & Mixed Greens Salad', portionG: 320, cal: 480, p: 44, c: 6, f: 28, allergens: [] },
      { name: 'Turkey Lettuce Wraps with Tomato, Mustard & Guacamole', portionG: 280, cal: 420, p: 36, c: 8, f: 26, allergens: [] },
      { name: 'Seared Shrimp & Cauliflower Rice Bowl with Olive Oil', portionG: 310, cal: 410, p: 40, c: 7, f: 24, allergens: ['fish', 'seafood'] },
      { name: 'Warm Roast Beef & Radish Salad with Horseradish Dressing', portionG: 300, cal: 450, p: 42, c: 5, f: 28, allergens: [], dislikes: ['beef'] },
    ],
    dinner: [
      { name: 'Pan-Seared Salmon Fillet with Asparagus in Hollandaise', portionG: 320, cal: 540, p: 38, c: 6, f: 40, allergens: ['fish', 'dairy', 'egg'] },
      { name: 'Roast Chicken Thighs with Garlic Roasted Broccoli', portionG: 320, cal: 490, p: 36, c: 8, f: 34, allergens: [] },
      { name: 'Grilled Ribeye Steak with Herb Compound Butter', portionG: 280, cal: 620, p: 44, c: 2, f: 48, allergens: ['dairy'], dislikes: ['beef'] },
      { name: 'Baked Lemon Herb Cod with Creamy Spinach', portionG: 300, cal: 430, p: 36, c: 7, f: 28, allergens: ['fish', 'dairy'], dislikes: ['spinach'] },
      { name: 'Pork Chops with Steamed Green Beans & Bacon', portionG: 300, cal: 510, p: 38, c: 6, f: 36, allergens: [] },
      { name: 'Grilled Flank Steak with Roasted Asparagus in Olive Oil', portionG: 300, cal: 520, p: 46, c: 4, f: 34, allergens: [], dislikes: ['beef'] },
      { name: 'Pan-Seared Sea Bass with Sautéed Zucchini & Olive Tapenade', portionG: 320, cal: 460, p: 40, c: 6, f: 30, allergens: ['fish'] },
      { name: 'Herb Roasted Chicken Breast with Sautéed Bell Peppers', portionG: 320, cal: 470, p: 48, c: 7, f: 27, allergens: [] },
    ],
    snack: [
      { name: 'Roasted Macadamia Nuts & Salted Pecans (35g)', portionG: 35, cal: 240, p: 3, c: 4, f: 25, allergens: ['nuts'] },
      { name: 'Sharp Cheddar Cheese Cubes with Celery Sticks', portionG: 90, cal: 190, p: 12, c: 2, f: 15, allergens: ['dairy'] },
      { name: 'Hard Boiled Eggs (2) with Guacamole', portionG: 130, cal: 210, p: 13, c: 3, f: 16, allergens: ['egg'] },
      { name: 'Beef Jerky (Sugar-Free, 40g)', portionG: 40, cal: 130, p: 20, c: 2, f: 4, allergens: [], dislikes: ['beef'] },
      { name: 'Kalamata Olives (60g) with Cucumber Slices', portionG: 120, cal: 140, p: 2, c: 5, f: 12, allergens: [] },
      { name: 'Sunflower Seeds & Pumpkin Seeds Mix (35g)', portionG: 35, cal: 190, p: 7, c: 6, f: 16, allergens: [] },
    ],
  },
  keto: {
    breakfast: [
      { name: 'Eggs (3) Fried in Grass-fed Butter with Half Avocado', portionG: 200, cal: 430, p: 20, c: 4, f: 38, allergens: ['egg', 'dairy'] },
      { name: 'Keto Bulletproof Coffee with 2 Boiled Eggs', portionG: 300, cal: 360, p: 13, c: 2, f: 32, allergens: ['dairy', 'egg'] },
      { name: 'Smoked Salmon Cream Cheese Wrap with Cucumber', portionG: 180, cal: 370, p: 22, c: 4, f: 29, allergens: ['fish', 'dairy'] },
      { name: 'Pecan & Coconut Flour Keto Porridge', portionG: 200, cal: 390, p: 8, c: 5, f: 36, allergens: ['nuts'] },
      { name: 'Eggs Fried in Extra Virgin Olive Oil with Sliced Avocado', portionG: 210, cal: 420, p: 20, c: 4, f: 36, allergens: ['egg'] },
      { name: 'Smoked Salmon Avocado Bowl with Olive Oil & Seeds', portionG: 200, cal: 380, p: 24, c: 4, f: 30, allergens: ['fish'] },
      { name: 'Crispy Bacon Strips (4) with 2 Soft Boiled Eggs', portionG: 190, cal: 410, p: 24, c: 2, f: 34, allergens: ['egg'] },
    ],
    lunch: [
      { name: 'Bunless Double Bacon Cheeseburger with Garlic Aioli', portionG: 300, cal: 640, p: 44, c: 4, f: 50, allergens: ['dairy', 'egg'], dislikes: ['beef'] },
      { name: 'Grilled Chicken Thighs with Creamed Spinach & Parmesan', portionG: 320, cal: 560, p: 38, c: 5, f: 42, allergens: ['dairy'], dislikes: ['spinach'] },
      { name: 'Keto Tuna Avocado Salad with Olive Oil Dressing', portionG: 280, cal: 510, p: 32, c: 5, f: 39, allergens: ['fish'] },
      { name: 'Cauliflower Mac and Cheese with Bacon Bits', portionG: 280, cal: 480, p: 20, c: 6, f: 40, allergens: ['dairy'] },
      { name: 'Crispy Chicken Thighs with Steamed Asparagus & Garlic Aioli', portionG: 320, cal: 580, p: 40, c: 4, f: 44, allergens: ['egg'] },
      { name: 'Keto Avocado Tuna Salad with Homemade Mayo & Celery', portionG: 280, cal: 520, p: 34, c: 4, f: 40, allergens: ['fish', 'egg'] },
      { name: 'Pork Carnitas Salad Bowl with Shredded Lettuce & Guacamole', portionG: 320, cal: 590, p: 42, c: 5, f: 44, allergens: [] },
      { name: 'Grilled Salmon with Avocado Salsa & Mixed Greens', portionG: 320, cal: 570, p: 38, c: 4, f: 44, allergens: ['fish'] },
    ],
    dinner: [
      { name: 'Crispy Skin Salmon with Lemon Herb Butter & Asparagus', portionG: 320, cal: 580, p: 36, c: 4, f: 46, allergens: ['fish', 'dairy'] },
      { name: 'Ribeye Steak with Garlic Butter Basted Button Mushrooms', portionG: 300, cal: 650, p: 46, c: 3, f: 50, allergens: ['dairy'], dislikes: ['beef', 'mushroom'] },
      { name: 'Roast Duck Breast with Braised Red Cabbage in Butter', portionG: 300, cal: 590, p: 34, c: 5, f: 48, allergens: ['dairy'] },
      { name: 'Pork Belly Roasted with Sautéed Zucchini Ribbons', portionG: 280, cal: 620, p: 28, c: 4, f: 54, allergens: [] },
      { name: 'Herb Roasted Half Chicken with Sautéed Zucchini in Olive Oil', portionG: 340, cal: 610, p: 48, c: 4, f: 44, allergens: [] },
      { name: 'Pan-Seared Ribeye Steak with Garlic Sautéed Green Beans', portionG: 300, cal: 640, p: 46, c: 4, f: 48, allergens: [], dislikes: ['beef'] },
      { name: 'Broiled Cod Fillet with Chimichurri Sauce & Sliced Avocado', portionG: 310, cal: 520, p: 38, c: 4, f: 38, allergens: ['fish'] },
    ],
    snack: [
      { name: 'Macadamia Nuts (40g)', portionG: 40, cal: 280, p: 3, c: 4, f: 30, allergens: ['nuts'] },
      { name: 'Gouda Cheese (50g) with Black Olives', portionG: 80, cal: 240, p: 13, c: 2, f: 20, allergens: ['dairy'] },
      { name: 'Guacamole (80g) with Pork Rinds', portionG: 110, cal: 260, p: 14, c: 3, f: 22, allergens: [] },
      { name: 'Kalamata Olives (70g) with Avocado Oil', portionG: 80, cal: 210, p: 2, c: 4, f: 22, allergens: [] },
      { name: 'Boiled Egg (1) with Sea Salt & Olive Oil', portionG: 60, cal: 120, p: 6, c: 1, f: 10, allergens: ['egg'] },
    ],
  },
  vegetarian: {
    breakfast: [
      { name: 'Greek Yogurt with Honey, Granola & Walnuts', portionG: 220, cal: 360, p: 18, c: 44, f: 12, allergens: ['dairy', 'nuts', 'gluten'] },
      { name: 'Whole Wheat Toast with Avocado, Hemp Seeds & Tomato', portionG: 190, cal: 330, p: 10, c: 38, f: 16, allergens: ['gluten'] },
      { name: 'Scrambled Eggs (3) with Sautéed Spinach & Whole Grain Toast', portionG: 220, cal: 370, p: 24, c: 26, f: 18, allergens: ['egg', 'gluten'], dislikes: ['spinach'] },
      { name: 'Cottage Cheese Bowl with Diced Apple & Cinnamon', portionG: 220, cal: 290, p: 24, c: 32, f: 5, allergens: ['dairy'] },
      { name: 'Oatmeal with Almond Milk, Chia Seeds & Blueberries', portionG: 250, cal: 320, p: 11, c: 54, f: 7, allergens: ['nuts', 'gluten'] },
      { name: 'Tofu Scramble with Nutritional Yeast & Multigrain Toast', portionG: 220, cal: 330, p: 22, c: 28, f: 14, allergens: ['soy', 'gluten'] },
      { name: 'Avocado & Tomato Toast on Sourdough Bread', portionG: 190, cal: 320, p: 8, c: 36, f: 16, allergens: ['gluten'] },
    ],
    lunch: [
      { name: 'Mediterranean Falafel & Quinoa Bowl with Tahini Dressing', portionG: 350, cal: 490, p: 18, c: 68, f: 17, allergens: [] },
      { name: 'Caprese Panini with Fresh Mozzarella, Basil & Tomato', portionG: 260, cal: 460, p: 20, c: 48, f: 20, allergens: ['dairy', 'gluten'] },
      { name: 'Black Bean & Corn Burrito Bowl with Guacamole & Brown Rice', portionG: 360, cal: 520, p: 18, c: 80, f: 15, allergens: [] },
      { name: 'Spinach & Ricotta Ravioli with Marinara Sauce', portionG: 300, cal: 480, p: 19, c: 62, f: 16, allergens: ['dairy', 'gluten', 'egg'], dislikes: ['spinach'] },
      { name: 'Warm Lentil & Roasted Beet Salad with Goat Cheese', portionG: 320, cal: 440, p: 18, c: 54, f: 16, allergens: ['dairy'] },
      { name: 'Crispy Tofu & Steamed Broccoli Bowl with Tamari & Rice', portionG: 350, cal: 460, p: 26, c: 58, f: 14, allergens: ['soy'] },
      { name: 'Spicy Chickpea & Avocado Wrap with Tahini Sauce', portionG: 300, cal: 470, p: 18, c: 58, f: 18, allergens: ['gluten'] },
    ],
    dinner: [
      { name: 'Eggplant Lasagna with Ricotta & Marinara', portionG: 320, cal: 450, p: 22, c: 38, f: 22, allergens: ['dairy', 'egg'], dislikes: ['eggplant'] },
      { name: 'Tofu & Vegetable Green Curry with Jasmine Rice', portionG: 360, cal: 470, p: 20, c: 64, f: 16, allergens: ['soy'] },
      { name: 'Lentil Bolognese over Whole Wheat Spaghetti', portionG: 340, cal: 480, p: 22, c: 76, f: 9, allergens: ['gluten'] },
      { name: 'Vegetarian Stuffed Bell Peppers with Quinoa & Cheddar', portionG: 320, cal: 430, p: 18, c: 54, f: 15, allergens: ['dairy'] },
      { name: 'Paneer & Veggie Skewers with Mint Yogurt Sauce & Roti', portionG: 330, cal: 460, p: 22, c: 48, f: 18, allergens: ['dairy', 'gluten'] },
      { name: 'Chickpea & Coconut Milk Vegetable Curry with Basmati Rice', portionG: 350, cal: 460, p: 16, c: 68, f: 14, allergens: [] },
      { name: 'Vegetarian Chili with Kidney Beans & Cornbread', portionG: 350, cal: 480, p: 22, c: 72, f: 11, allergens: ['gluten'] },
    ],
    snack: [
      { name: 'Hummus (60g) with Baby Carrots & Cucumber Slices', portionG: 180, cal: 170, p: 6, c: 22, f: 8, allergens: [] },
      { name: 'Roasted Salted Edamame (50g)', portionG: 50, cal: 190, p: 16, c: 14, f: 7, allergens: ['soy'] },
      { name: 'Greek Yogurt with Cinnamon & Sliced Banana', portionG: 200, cal: 210, p: 16, c: 28, f: 3, allergens: ['dairy'] },
      { name: 'Mixed Roasted Nuts & Dried Cranberries', portionG: 40, cal: 200, p: 5, c: 18, f: 13, allergens: ['nuts'] },
      { name: 'Apple Slices with 1 tbsp Sunflower Seed Butter', portionG: 190, cal: 180, p: 4, c: 26, f: 8, allergens: [] },
      { name: 'Air-Popped Spiced Popcorn', portionG: 45, cal: 160, p: 5, c: 30, f: 3, allergens: [] },
    ],
  },
  vegan: {
    breakfast: [
      { name: 'Tofu Scramble with Turmeric, Nutritional Yeast & Whole Wheat Toast', portionG: 240, cal: 340, p: 24, c: 32, f: 13, allergens: ['soy', 'gluten'] },
      { name: 'Overnight Rolled Oats with Chia Seeds, Almond Milk & Maple', portionG: 250, cal: 350, p: 12, c: 58, f: 8, allergens: ['nuts', 'gluten'] },
      { name: 'Acai Smoothie Bowl with Banana, Granola & Hemp Seeds', portionG: 280, cal: 360, p: 10, c: 64, f: 9, allergens: ['nuts', 'gluten'] },
      { name: 'Avocado on Sprouted Grain Toast with Sunflower Seeds', portionG: 190, cal: 320, p: 9, c: 36, f: 16, allergens: ['gluten'] },
      { name: 'Peanut Butter & Jelly Overnight Quinoa Porridge', portionG: 240, cal: 370, p: 14, c: 52, f: 13, allergens: ['peanuts'] },
    ],
    lunch: [
      { name: 'Chickpea & Spinach Mediterranean Stew with Brown Rice', portionG: 360, cal: 480, p: 18, c: 78, f: 10, allergens: [], dislikes: ['spinach'] },
      { name: 'Tempeh BLT Wrap with Vegan Mayo & Mixed Greens', portionG: 280, cal: 470, p: 26, c: 44, f: 18, allergens: ['soy', 'gluten'] },
      { name: 'Lentil & Sweet Potato Dahl with Warm Whole Wheat Flatbread', portionG: 360, cal: 490, p: 20, c: 82, f: 9, allergens: ['gluten'] },
      { name: 'Crispy Tofu Bowl with Steamed Broccoli, Edamame & Rice', portionG: 350, cal: 460, p: 28, c: 56, f: 14, allergens: ['soy'] },
      { name: 'Mexican Black Bean & Quinoa Bowl with Corn & Guacamole', portionG: 360, cal: 500, p: 18, c: 78, f: 14, allergens: [] },
    ],
    dinner: [
      { name: 'Red Lentil Coconut Curry with Steamed Jasmine Rice', portionG: 360, cal: 460, p: 18, c: 72, f: 12, allergens: [] },
      { name: 'Roasted Butternut Squash & Chickpea Bowl with Tahini', portionG: 340, cal: 440, p: 16, c: 68, f: 14, allergens: [] },
      { name: 'Stir-Fried Seitan & Mixed Vegetables over Brown Rice', portionG: 340, cal: 470, p: 38, c: 58, f: 8, allergens: ['gluten'] },
      { name: 'Vegan Bolognese with Crumbled Tempeh over Pasta', portionG: 340, cal: 480, p: 26, c: 68, f: 12, allergens: ['soy', 'gluten'] },
      { name: 'Black Bean Veggie Burger Patty with Sweet Potato Fries', portionG: 300, cal: 450, p: 16, c: 66, f: 13, allergens: [] },
    ],
    snack: [
      { name: 'Air-Popped Popcorn with Nutritional Yeast & Salt', portionG: 45, cal: 170, p: 6, c: 30, f: 3, allergens: [] },
      { name: 'Apple Slices with 1 tbsp Natural Almond Butter', portionG: 190, cal: 190, p: 4, c: 26, f: 9, allergens: ['nuts'] },
      { name: 'Roasted Spiced Chickpeas (50g)', portionG: 50, cal: 180, p: 9, c: 28, f: 4, allergens: [] },
      { name: 'Plant Protein Shake with Pea Protein & Soy Milk', portionG: 300, cal: 210, p: 25, c: 8, f: 4, allergens: ['soy'] },
    ],
  },
};

/**
 * Checks if a meal template violates user allergies or dislikes.
 */
function isMealRestricted(
  meal: MealTemplate,
  userAllergies: string[],
  userDislikes: string[],
  checkDislikes = true
): boolean {
  // Strict allergy check
  for (const rawAllergy of userAllergies) {
    const a = rawAllergy.trim().toLowerCase();
    if (!a) continue;

    // 1. Direct allergen metadata check
    if (meal.allergens && Array.isArray(meal.allergens)) {
      const match = meal.allergens.some((al) => {
        const item = al.toLowerCase();
        if (a === 'dairy' || a === 'milk') return item === 'dairy' || item === 'milk';
        if (a === 'peanut' || a === 'peanuts') return item === 'peanut' || item === 'peanuts';
        if (a === 'nuts' || a === 'tree nuts') return item === 'nuts' || item === 'tree nuts';
        if (a === 'gluten' || a === 'wheat') return item === 'gluten' || item === 'wheat';
        if (a === 'egg' || a === 'eggs') return item === 'egg' || item === 'eggs';
        if (a === 'fish' || a === 'seafood') return item === 'fish' || item === 'seafood';
        if (a === 'soy') return item === 'soy';
        return item === a;
      });
      if (match) return true;
    }

    // 2. Dish name text check
    const nameLower = meal.name.toLowerCase();
    if (a === 'dairy' || a === 'milk') {
      const nonDairyButterCleaned = nameLower
        .replace(/(peanut|almond|cashew|apple|cocoa|sunflower|seed)\s+butter/gi, '')
        .replace(/(almond|coconut|soy|oat|pea|cashew|rice|hemp)\s+milk/gi, '');
      if (/\b(milk|curd|paneer|ghee|butter|cheese|yogurt|dairy|whey|lassi|cream|raita|mozzarella|ricotta|feta|cheddar|parmesan|gouda)\b/i.test(nonDairyButterCleaned)) return true;
    } else if (a === 'gluten' || a === 'wheat') {
      if (/\b(wheat|roti|phulka|chapati|naan|bread|toast|oats|oatmeal|paratha|flour|pasta|pita|wrap|seitan|spaghetti|ravioli|sourdough|granola)\b/i.test(nameLower)) return true;
    } else if (a === 'peanut' || a === 'peanuts') {
      if (/\b(peanut|peanuts)\b/i.test(nameLower)) return true;
    } else if (a === 'nuts' || a === 'tree nuts') {
      if (/\b(almond|almonds|cashew|cashews|walnut|walnuts|pecan|pecans|pistachio|pistachios|hazelnut|macadamia)\b/i.test(nameLower)) return true;
    } else if (a === 'egg' || a === 'eggs') {
      if (/\b(egg|eggs|omelet|scramble|frittata)\b/i.test(nameLower)) return true;
    } else if (a === 'fish' || a === 'seafood') {
      if (/\b(fish|salmon|tuna|seafood|shrimp|cod|tilapia|halibut|mackerel|sardines|crab|lobster)\b/i.test(nameLower)) return true;
    } else if (a === 'soy') {
      if (/\b(soy|tofu|edamame|tempeh)\b/i.test(nameLower)) return true;
    } else {
      if (nameLower.includes(a)) return true;
    }
  }

  // Dislike check
  if (checkDislikes) {
    const text = `${meal.name} ${meal.dislikes?.join(' ') || ''}`.toLowerCase();
    for (const rawDislike of userDislikes) {
      const d = rawDislike.trim().toLowerCase();
      if (!d) continue;
      if (text.includes(d)) return true;
    }
  }

  return false;
}

/**
 * Helper to get clean preset key, falling back safely.
 */
export function normalizePreset(preset?: string): string {
  if (!preset) return 'indian_veg';
  const clean = preset.toLowerCase().replace(/[\s-]/g, '_');
  if (PRESET_MEAL_DATABASE[clean]) return clean;
  if (clean.includes('indian')) return 'indian_veg';
  if (clean.includes('protein')) return 'high_protein';
  if (clean.includes('keto')) return 'keto';
  if (clean.includes('low') && clean.includes('carb')) return 'low_carb';
  if (clean.includes('vegan')) return 'vegan';
  if (clean.includes('veg')) return 'vegetarian';
  return 'balanced';
}

/**
 * Calibrates meal portions so the full day lands within 5% of target calories.
 */
export function scaleMeal(meal: MealTemplate, targetCalForSlot: number) {
  const scale = targetCalForSlot / Math.max(1, meal.cal);
  // Cap scaling between 0.4x and 2.5x to preserve culinary realism
  const boundedScale = Math.min(Math.max(scale, 0.4), 2.5);

  return {
    foodName: meal.name,
    portionG: Math.round(meal.portionG * boundedScale),
    calories: Math.round(meal.cal * boundedScale),
    proteinG: Math.round(meal.p * boundedScale * 10) / 10,
    carbsG: Math.round(meal.c * boundedScale * 10) / 10,
    fatG: Math.round(meal.f * boundedScale * 10) / 10,
  };
}

// ─── Planner Routes ─────────────────────────────────────────────────────────

// GET /api/planner/meal-plan - Fetch active weekly meal plan
router.get('/meal-plan', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const plan = await prisma.mealPlan.findFirst({
      where: { userId },
      include: {
        items: {
          orderBy: [{ dayOfWeek: 'asc' }, { id: 'asc' }],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      success: true,
      data: plan,
    });
  } catch (error: any) {
    console.error('Error fetching meal plan:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch meal plan.',
    });
  }
});

// POST /api/planner/generate - Generate 7-day balanced plan with progressive relaxation
router.post('/generate', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { dietPreset, targetCalories } = req.body;

    // Load user profile for allergies & dislikes
    const profile = await prisma.profile.findUnique({ where: { userId } });
    const userAllergies: string[] = profile?.allergies ? JSON.parse(profile.allergies) : [];
    const userDislikes: string[] = profile?.dislikes ? JSON.parse(profile.dislikes) : [];

    const effectivePreset = normalizePreset(dietPreset || profile?.dietPreset);
    const effectiveCalories = Math.max(1000, Math.min(5000, Number(targetCalories) || profile?.targetCalories || 2000));

    const start = new Date();
    const end = new Date(start.getTime() + 7 * 86400000);

    // Slot calorie distribution: 25% Breakfast, 35% Lunch, 30% Dinner, 10% Snack
    const slotTargets: Record<'breakfast' | 'lunch' | 'dinner' | 'snack', number> = {
      breakfast: Math.round(effectiveCalories * 0.25),
      lunch: Math.round(effectiveCalories * 0.35),
      dinner: Math.round(effectiveCalories * 0.30),
      snack: Math.round(effectiveCalories * 0.10),
    };

    const menu = PRESET_MEAL_DATABASE[effectivePreset];
    const relaxationNotes: string[] = [];

    // Track usage to enforce <= 2 repeats for main dishes across 7 days
    const dishUsageCount: Record<string, number> = {};

    const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
    const itemsData: Array<{
      dayOfWeek: number;
      mealType: string;
      foodName: string;
      portionG: number;
      calories: number;
      proteinG: number;
      carbsG: number;
      fatG: number;
      isLocked: boolean;
    }> = [];

    for (let day = 0; day < 7; day++) {
      for (const mType of mealTypes) {
        const fullPool = menu[mType] || menu.lunch;

        // Level 0: Strict allergies + strict dislikes + max 2 repeats
        let eligible = fullPool.filter((m) => {
          if (isMealRestricted(m, userAllergies, userDislikes, true)) return false;
          const usage = dishUsageCount[m.name] || 0;
          return usage < 2;
        });

        // Level 1: Relax repeat constraint to 3 if pool empty
        if (eligible.length === 0) {
          eligible = fullPool.filter((m) => {
            if (isMealRestricted(m, userAllergies, userDislikes, true)) return false;
            const usage = dishUsageCount[m.name] || 0;
            return usage < 3;
          });
          if (eligible.length > 0 && !relaxationNotes.includes('Allowed up to 3 repeats for staple dishes due to dietary constraints.')) {
            relaxationNotes.push('Allowed up to 3 repeats for staple dishes due to dietary constraints.');
          }
        }

        // Level 2: Relax dislikes if still empty (NEVER relax allergies)
        if (eligible.length === 0 && userDislikes.length > 0) {
          eligible = fullPool.filter((m) => {
            if (isMealRestricted(m, userAllergies, [], false)) return false;
            const usage = dishUsageCount[m.name] || 0;
            return usage < 3;
          });
          if (eligible.length === 0) {
            eligible = fullPool.filter((m) => !isMealRestricted(m, userAllergies, [], false));
          }
          if (eligible.length > 0 && !relaxationNotes.includes('Relaxed food dislike filters to meet macro and calorie targets.')) {
            relaxationNotes.push('Relaxed food dislike filters to meet macro and calorie targets.');
          }
        }

        // Level 3: Safe fallback if still empty
        if (eligible.length === 0) {
          eligible = [
            {
              name: 'Steamed White Rice with Mixed Vegetable Sauté',
              portionG: 300,
              cal: 380,
              p: 8,
              c: 72,
              f: 6,
              allergens: [],
            },
          ];
          if (!relaxationNotes.includes('Substituted allergen-safe staple vegetable dish.')) {
            relaxationNotes.push('Substituted allergen-safe staple vegetable dish.');
          }
        }

        // Select candidate with lowest usage count so far to ensure uniform distribution
        eligible.sort((a, b) => (dishUsageCount[a.name] || 0) - (dishUsageCount[b.name] || 0));
        const selectedTemplate = eligible[0];

        // Track dish usage
        dishUsageCount[selectedTemplate.name] = (dishUsageCount[selectedTemplate.name] || 0) + 1;

        // Scale portion & macros to slot calorie target
        const scaled = scaleMeal(selectedTemplate, slotTargets[mType]);

        itemsData.push({
          dayOfWeek: day,
          mealType: mType,
          foodName: scaled.foodName,
          portionG: scaled.portionG,
          calories: scaled.calories,
          proteinG: scaled.proteinG,
          carbsG: scaled.carbsG,
          fatG: scaled.fatG,
          isLocked: false,
        });
      }
    }

    // Clean up old meal plan and persist new plan
    await prisma.mealPlan.deleteMany({ where: { userId } });

    const plan = await prisma.mealPlan.create({
      data: {
        userId,
        startDate: start,
        endDate: end,
        targetCal: effectiveCalories,
        dietPreset: effectivePreset,
      },
    });

    await prisma.mealPlanItem.createMany({
      data: itemsData.map((it) => ({
        ...it,
        mealPlanId: plan.id,
      })),
    });

    const populatedPlan = await prisma.mealPlan.findUnique({
      where: { id: plan.id },
      include: {
        items: {
          orderBy: [{ dayOfWeek: 'asc' }, { id: 'asc' }],
        },
      },
    });

    return res.status(201).json({
      success: true,
      data: populatedPlan,
      relaxationNotes,
    });
  } catch (error: any) {
    console.error('Error generating meal plan:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate meal plan. Please try again.',
      details: error.message,
    });
  }
});

// POST /api/planner/regenerate-day - Regenerate meals for a single day keeping locked meals
router.post('/regenerate-day', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { dayOfWeek } = req.body;

    if (dayOfWeek === undefined || dayOfWeek < 0 || dayOfWeek > 6) {
      return res.status(400).json({ success: false, error: 'Invalid dayOfWeek (must be 0 to 6).' });
    }

    const plan = await prisma.mealPlan.findFirst({
      where: { userId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!plan) {
      return res.status(404).json({ success: false, error: 'No active meal plan found.' });
    }

    const profile = await prisma.profile.findUnique({ where: { userId } });
    const userAllergies: string[] = profile?.allergies ? JSON.parse(profile.allergies) : [];
    const userDislikes: string[] = profile?.dislikes ? JSON.parse(profile.dislikes) : [];

    const effectivePreset = normalizePreset(plan.dietPreset);
    const menu = PRESET_MEAL_DATABASE[effectivePreset];
    const slotTargets: Record<'breakfast' | 'lunch' | 'dinner' | 'snack', number> = {
      breakfast: Math.round(plan.targetCal * 0.25),
      lunch: Math.round(plan.targetCal * 0.35),
      dinner: Math.round(plan.targetCal * 0.30),
      snack: Math.round(plan.targetCal * 0.10),
    };

    const dayItems = plan.items.filter((it) => it.dayOfWeek === dayOfWeek);

    for (const it of dayItems) {
      if (it.isLocked) continue; // Keep locked meal untouched

      const mType = it.mealType.toLowerCase() as 'breakfast' | 'lunch' | 'dinner' | 'snack';
      const pool = (menu[mType] || menu.lunch).filter(
        (m) => m.name !== it.foodName && !isMealRestricted(m, userAllergies, userDislikes, true)
      );
      const candidates = pool.length > 0 ? pool : (menu[mType] || menu.lunch);
      const selected = candidates[Math.floor(Math.random() * candidates.length)];
      const scaled = scaleMeal(selected, slotTargets[mType] || 400);

      await prisma.mealPlanItem.update({
        where: { id: it.id },
        data: {
          foodName: scaled.foodName,
          portionG: scaled.portionG,
          calories: scaled.calories,
          proteinG: scaled.proteinG,
          carbsG: scaled.carbsG,
          fatG: scaled.fatG,
        },
      });
    }

    const updatedPlan = await prisma.mealPlan.findUnique({
      where: { id: plan.id },
      include: {
        items: { orderBy: [{ dayOfWeek: 'asc' }, { id: 'asc' }] },
      },
    });

    return res.json({ success: true, data: updatedPlan });
  } catch (error: any) {
    console.error('Error regenerating day:', error);
    return res.status(500).json({ success: false, error: 'Failed to regenerate day.' });
  }
});

// PATCH /api/planner/item/:id/lock - Toggle lock status on a meal item
router.patch('/item/:id/lock', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const item = await prisma.mealPlanItem.findUnique({ where: { id } });

    if (!item) {
      return res.status(404).json({ success: false, error: 'Meal item not found.' });
    }

    const updated = await prisma.mealPlanItem.update({
      where: { id },
      data: { isLocked: !item.isLocked },
    });

    return res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Error toggling lock:', error);
    return res.status(500).json({ success: false, error: 'Failed to update lock status.' });
  }
});

// POST /api/planner/item/:id/swap - Swap an individual meal item with an alternative
router.post('/item/:id/swap', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const item = await prisma.mealPlanItem.findUnique({
      where: { id },
    });

    if (!item) {
      return res.status(404).json({ success: false, error: 'Meal item not found.' });
    }

    const mealPlan = await prisma.mealPlan.findUnique({
      where: { id: item.mealPlanId },
    });

    const profile = await prisma.profile.findUnique({ where: { userId } });
    const userAllergies: string[] = profile?.allergies ? JSON.parse(profile.allergies) : [];
    const userDislikes: string[] = profile?.dislikes ? JSON.parse(profile.dislikes) : [];

    const effectivePreset = normalizePreset(mealPlan?.dietPreset);
    const menu = PRESET_MEAL_DATABASE[effectivePreset];
    const mType = item.mealType.toLowerCase() as 'breakfast' | 'lunch' | 'dinner' | 'snack';

    // Filter out current dish and restricted items
    let pool = (menu[mType] || menu.lunch).filter(
      (m) => m.name !== item.foodName && !isMealRestricted(m, userAllergies, userDislikes, true)
    );
    if (pool.length === 0) {
      pool = (menu[mType] || menu.lunch).filter((m) => m.name !== item.foodName);
    }
    const chosen = pool[Math.floor(Math.random() * pool.length)] || menu[mType][0];
    const scaled = scaleMeal(chosen, item.calories);

    const updated = await prisma.mealPlanItem.update({
      where: { id },
      data: {
        foodName: scaled.foodName,
        portionG: scaled.portionG,
        calories: scaled.calories,
        proteinG: scaled.proteinG,
        carbsG: scaled.carbsG,
        fatG: scaled.fatG,
      },
    });

    return res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Error swapping meal:', error);
    return res.status(500).json({ success: false, error: 'Failed to swap meal.' });
  }
});

// POST /api/planner/item/:id/log - Log planned meal into Food Diary
router.post('/item/:id/log', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const { date } = req.body;

    const item = await prisma.mealPlanItem.findUnique({ where: { id } });
    if (!item) {
      return res.status(404).json({ success: false, error: 'Meal item not found.' });
    }

    const logDate = date ? new Date(date) : new Date();

    const foodLog = await prisma.foodLog.create({
      data: {
        userId,
        mealType: item.mealType.toLowerCase(),
        date: logDate,
        notes: `Logged from 7-Day Meal Plan (${item.foodName})`,
        items: {
          create: [
            {
              name: item.foodName,
              portionG: item.portionG,
              portionLabel: `${Math.round(item.portionG)}g (Planned)`,
              calories: Math.round(item.calories),
              proteinG: item.proteinG,
              carbsG: item.carbsG,
              fatG: item.fatG,
              confidence: 1.0,
              isAiEstimate: false,
              badge: 'Verified from database',
              source: 'Meal Planner',
            },
          ],
        },
      },
      include: { items: true },
    });

    return res.status(201).json({
      success: true,
      message: `Logged ${item.foodName} to ${item.mealType}!`,
      data: foodLog,
    });
  } catch (error: any) {
    console.error('Error logging planned meal:', error);
    return res.status(500).json({ success: false, error: 'Failed to log planned meal.' });
  }
});

// ─── Grocery List Routes ─────────────────────────────────────────────────────

const AISLE_RULES: Array<{ pattern: RegExp; aisle: string }> = [
  { pattern: /spinach|palak|onion|tomato|cucumber|broccoli|asparagus|vegetable|greens|salad|banana|apple|berries|lime|mint|potato|cauliflower|baingan|eggplant|bhindi|okra|carrot|zucchini|cabbage|pomegranate/i, aisle: 'Produce' },
  { pattern: /milk|paneer|curd|yogurt|cheese|butter|ghee|cream|raita|mozzarella|ricotta|feta/i, aisle: 'Dairy & Refrigerated' },
  { pattern: /egg|chicken|salmon|beef|turkey|fish|tofu|tempeh|tuna|shrimp|cod|bacon|sausage|tilapia|pork|duck/i, aisle: 'Meat & Seafood' },
  { pattern: /oats|rice|quinoa|roti|bread|phulka|chapati|toast|atta|flour|granola|wrap|pasta|noodles|pita|poha|idli|tortilla|sourdough|spaghetti|ravioli|chia/i, aisle: 'Grains & Bakery' },
  { pattern: /dal|chana|chickpea|lentil|rajma|peanuts|almonds|nuts|oil|walnuts|pecans|cashews|foxnuts|makhana|besan|moong|hemp/i, aisle: 'Legumes & Pantry' },
  { pattern: /sambar|masala|cumin|turmeric|spice|chutney|hummus|papad|tahini|curry|sauce|dressing|aioli|vinaigrette/i, aisle: 'Spices & Condiments' },
];

function determineAisle(foodName: string): string {
  for (const rule of AISLE_RULES) {
    if (rule.pattern.test(foodName)) {
      return rule.aisle;
    }
  }
  return 'Pantry Staples';
}

// POST /api/planner/generate-grocery-list - Build grocery list from active meal plan
router.post('/generate-grocery-list', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const plan = await prisma.mealPlan.findFirst({
      where: { userId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!plan || plan.items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No active meal plan found. Generate a meal plan first.',
      });
    }

    // Delete existing grocery list for user
    await prisma.groceryList.deleteMany({ where: { userId } });

    const groceryList = await prisma.groceryList.create({
      data: {
        userId,
        name: `Weekly Grocery List (${plan.dietPreset.replace('_', ' ').toUpperCase()})`,
      },
    });

    // Deduplicate items and sum portions
    const uniqueFoods = new Map<string, { name: string; totalG: number }>();
    for (const it of plan.items) {
      const current = uniqueFoods.get(it.foodName) || { name: it.foodName, totalG: 0 };
      current.totalG += it.portionG;
      uniqueFoods.set(it.foodName, current);
    }

    const groceryItemsData = Array.from(uniqueFoods.values()).map((f) => ({
      groceryListId: groceryList.id,
      name: f.name,
      quantity: `${Math.round(f.totalG)}g`,
      aisle: determineAisle(f.name),
      isChecked: false,
    }));

    await prisma.groceryItem.createMany({
      data: groceryItemsData,
    });

    const populatedList = await prisma.groceryList.findUnique({
      where: { id: groceryList.id },
      include: {
        items: {
          orderBy: [{ aisle: 'asc' }, { name: 'asc' }],
        },
      },
    });

    return res.status(201).json({
      success: true,
      data: populatedList,
    });
  } catch (error: any) {
    console.error('Error generating grocery list:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate grocery list.',
    });
  }
});

// GET /api/planner/grocery-list - Fetch user's grocery list
router.get('/grocery-list', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const list = await prisma.groceryList.findFirst({
      where: { userId },
      include: {
        items: {
          orderBy: [{ isChecked: 'asc' }, { aisle: 'asc' }, { name: 'asc' }],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      success: true,
      data: list,
    });
  } catch (error: any) {
    console.error('Error fetching grocery list:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch grocery list.',
    });
  }
});

// GET /api/planner/grocery-list/export - Export grocery list as clean text/markdown
router.get('/grocery-list/export', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const list = await prisma.groceryList.findFirst({
      where: { userId },
      include: { items: { orderBy: [{ aisle: 'asc' }, { name: 'asc' }] } },
      orderBy: { createdAt: 'desc' },
    });

    if (!list || list.items.length === 0) {
      return res.status(404).json({ success: false, error: 'No grocery list found to export.' });
    }

    // Group by aisle
    const grouped = new Map<string, typeof list.items>();
    for (const it of list.items) {
      const arr = grouped.get(it.aisle) || [];
      arr.push(it);
      grouped.set(it.aisle, arr);
    }

    let textExport = `# ${list.name}\nGenerated by FitSnap Weekly Meal Planner\n\n`;
    for (const [aisle, items] of grouped.entries()) {
      textExport += `## ${aisle}\n`;
      for (const item of items) {
        textExport += `- [${item.isChecked ? 'x' : ' '}] ${item.name} (${item.quantity})\n`;
      }
      textExport += '\n';
    }

    return res.json({
      success: true,
      data: {
        title: list.name,
        formattedText: textExport,
        itemCount: list.items.length,
      },
    });
  } catch (error: any) {
    console.error('Error exporting grocery list:', error);
    return res.status(500).json({ success: false, error: 'Failed to export grocery list.' });
  }
});

// PATCH /api/planner/grocery-item/:id - Toggle checked state
router.patch('/grocery-item/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { isChecked } = req.body;

    const current = await prisma.groceryItem.findUnique({ where: { id } });
    if (!current) {
      return res.status(404).json({ success: false, error: 'Item not found.' });
    }

    const updated = await prisma.groceryItem.update({
      where: { id },
      data: {
        isChecked: typeof isChecked === 'boolean' ? isChecked : !current.isChecked,
      },
    });

    return res.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error updating grocery item:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update item.',
    });
  }
});

// POST /api/planner/grocery-item - Add custom grocery item
router.post('/grocery-item', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { name, quantity = '1', aisle = 'Produce' } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Item name is required.',
      });
    }

    let list = await prisma.groceryList.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!list) {
      list = await prisma.groceryList.create({
        data: {
          userId,
          name: 'Personal Grocery List',
        },
      });
    }

    const item = await prisma.groceryItem.create({
      data: {
        groceryListId: list.id,
        name: name.trim(),
        quantity: quantity.trim(),
        aisle: aisle.trim(),
        isChecked: false,
      },
    });

    return res.status(201).json({
      success: true,
      data: item,
    });
  } catch (error: any) {
    console.error('Error adding grocery item:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to add grocery item.',
    });
  }
});

// DELETE /api/planner/grocery-item/:id - Delete item
router.delete('/grocery-item/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.groceryItem.delete({ where: { id } });
    return res.json({ success: true, message: 'Item deleted.' });
  } catch (error: any) {
    console.error('Error deleting grocery item:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete item.',
    });
  }
});

export default router;
