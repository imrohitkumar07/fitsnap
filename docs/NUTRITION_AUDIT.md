# FitSnap Nutrition Database Integrity & Traceability Audit

**Generated:** November 2026  
**Database Size:** 7404 unified entries  
**Verified Entries:** 6690 (90.4%)  
**Approximate Entries:** 714 (9.6%)  

## 1. Audit Standards & Validation Rules

Every entry in the unified nutrition database is systematically validated against three strict criteria:
1. **Atwater Energy Consistency:** Caloric density must be within **8%** of the standard Atwater formula:
   $$\text{Expected Kcal} = 4 \times \text{Protein (g)} + 4 \times \text{Carbs (g)} + 9 \times \text{Fat (g)}$$
   Entries deviating by > 8% are transparently labeled `approximate` rather than silently trusted.
2. **Macronutrient Mass Conservation:** Total macronutrient sum $(P + C + F) \le 100.5\text{g}$ per 100g of food.
3. **Category Plausibility:** Physical bounds checking (e.g. pure oils $\approx 800-900$ kcal, raw greens $< 150$ kcal).

## 2. Multi-Source Conflict Review (> 20% Calorie Difference)

When identical foods appear in both USDA Survey (FNDDS), USDA Foundation/SR Legacy, or ICMR/IFCT tables, calories are compared. Where values diverge by more than 20%, both entries are flagged and marked `approximate` for user review:

| Food Name | Source 1 | Kcal 1 | Source 2 | Kcal 2 | Divergence (%) | Transparent Note |
|---|---|---|---|---|---|---|
| Yogurt, whole milk, plain | usda_fndds | 78.0 | usda_foundation | 32.9 | 81.3% | Discrepancy: Yogurt, whole milk, plain has 78.0 kcal in usda_fndds vs 32.9 kcal in usda_foundation (81.3% difference). |
| Yogurt, whole milk, plain | usda_fndds | 78.0 | usda_foundation | 36.8 | 71.8% | Discrepancy: Yogurt, whole milk, plain has 78.0 kcal in usda_fndds vs 36.8 kcal in usda_foundation (71.8% difference). |
| Yogurt, whole milk, plain | usda_fndds | 78.0 | usda_foundation | 40.1 | 64.2% | Discrepancy: Yogurt, whole milk, plain has 78.0 kcal in usda_fndds vs 40.1 kcal in usda_foundation (64.2% difference). |
| Yogurt, whole milk, plain | usda_fndds | 78.0 | usda_foundation | 45.6 | 52.4% | Discrepancy: Yogurt, whole milk, plain has 78.0 kcal in usda_fndds vs 45.6 kcal in usda_foundation (52.4% difference). |
| Yogurt, whole milk, plain | usda_fndds | 78.0 | usda_foundation | 41.4 | 61.3% | Discrepancy: Yogurt, whole milk, plain has 78.0 kcal in usda_fndds vs 41.4 kcal in usda_foundation (61.3% difference). |
| Yogurt, whole milk, plain | usda_fndds | 78.0 | usda_foundation | 41.1 | 62.0% | Discrepancy: Yogurt, whole milk, plain has 78.0 kcal in usda_fndds vs 41.1 kcal in usda_foundation (62.0% difference). |
| Yogurt, whole milk, plain | usda_fndds | 78.0 | usda_foundation | 33.8 | 79.1% | Discrepancy: Yogurt, whole milk, plain has 78.0 kcal in usda_fndds vs 33.8 kcal in usda_foundation (79.1% difference). |
| Yogurt, whole milk, plain | usda_fndds | 78.0 | usda_foundation | 50.9 | 42.0% | Discrepancy: Yogurt, whole milk, plain has 78.0 kcal in usda_fndds vs 50.9 kcal in usda_foundation (42.0% difference). |
| Yogurt, Greek, whole milk, plain | usda_fndds | 94.0 | usda_foundation | 45.4 | 69.7% | Discrepancy: Yogurt, Greek, whole milk, plain has 94.0 kcal in usda_fndds vs 45.4 kcal in usda_foundation (69.7% difference). |
| Yogurt, Greek, whole milk, plain | usda_fndds | 94.0 | usda_foundation | 36.0 | 89.2% | Discrepancy: Yogurt, Greek, whole milk, plain has 94.0 kcal in usda_fndds vs 36.0 kcal in usda_foundation (89.2% difference). |
| Yogurt, Greek, whole milk, plain | usda_fndds | 94.0 | usda_foundation | 32.9 | 96.3% | Discrepancy: Yogurt, Greek, whole milk, plain has 94.0 kcal in usda_fndds vs 32.9 kcal in usda_foundation (96.3% difference). |
| Yogurt, Greek, whole milk, plain | usda_fndds | 94.0 | usda_foundation | 42.6 | 75.3% | Discrepancy: Yogurt, Greek, whole milk, plain has 94.0 kcal in usda_fndds vs 42.6 kcal in usda_foundation (75.3% difference). |
| Yogurt, Greek, whole milk, plain | usda_fndds | 94.0 | usda_foundation | 49.4 | 62.2% | Discrepancy: Yogurt, Greek, whole milk, plain has 94.0 kcal in usda_fndds vs 49.4 kcal in usda_foundation (62.2% difference). |
| Yogurt, Greek, whole milk, plain | usda_fndds | 94.0 | usda_foundation | 33.5 | 94.9% | Discrepancy: Yogurt, Greek, whole milk, plain has 94.0 kcal in usda_fndds vs 33.5 kcal in usda_foundation (94.9% difference). |
| Yogurt, Greek, whole milk, plain | usda_fndds | 94.0 | usda_foundation | 32.7 | 96.8% | Discrepancy: Yogurt, Greek, whole milk, plain has 94.0 kcal in usda_fndds vs 32.7 kcal in usda_foundation (96.8% difference). |
| Yogurt, Greek, whole milk, plain | usda_fndds | 94.0 | usda_foundation | 43.9 | 72.7% | Discrepancy: Yogurt, Greek, whole milk, plain has 94.0 kcal in usda_fndds vs 43.9 kcal in usda_foundation (72.7% difference). |
| Bread, oat bran | usda_fndds | 299.0 | usda_sr_legacy | 236.0 | 23.6% | Discrepancy: Bread, oat bran has 299.0 kcal in usda_fndds vs 236.0 kcal in usda_sr_legacy (23.6% difference). |
| Pineapple, raw | usda_fndds | 60.0 | usda_foundation | 3.9 | 175.6% | Discrepancy: Pineapple, raw has 60.0 kcal in usda_fndds vs 3.9 kcal in usda_foundation (175.6% difference). |
| Pineapple, raw | usda_fndds | 60.0 | usda_foundation | 3.0 | 181.0% | Discrepancy: Pineapple, raw has 60.0 kcal in usda_fndds vs 3.0 kcal in usda_foundation (181.0% difference). |
| Pineapple, raw | usda_fndds | 60.0 | usda_foundation | 0.8 | 194.7% | Discrepancy: Pineapple, raw has 60.0 kcal in usda_fndds vs 0.8 kcal in usda_foundation (194.7% difference). |
| Pineapple, raw | usda_fndds | 60.0 | usda_foundation | 2.0 | 187.1% | Discrepancy: Pineapple, raw has 60.0 kcal in usda_fndds vs 2.0 kcal in usda_foundation (187.1% difference). |
| Pineapple, raw | usda_fndds | 60.0 | usda_foundation | 1.8 | 188.3% | Discrepancy: Pineapple, raw has 60.0 kcal in usda_fndds vs 1.8 kcal in usda_foundation (188.3% difference). |
| Pineapple, raw | usda_fndds | 60.0 | usda_foundation | 3.8 | 176.2% | Discrepancy: Pineapple, raw has 60.0 kcal in usda_fndds vs 3.8 kcal in usda_foundation (176.2% difference). |
| Spinach souffle | usda_fndds | 128.0 | usda_sr_legacy | 172.0 | 29.3% | Discrepancy: Spinach souffle has 128.0 kcal in usda_fndds vs 172.0 kcal in usda_sr_legacy (29.3% difference). |
| Palak Paneer | usda_fndds | 101.0 | curated - ICMR / IFCT (Indian Food Composition Tables 2017) | 145.0 | 35.8% | Discrepancy: Palak Paneer has 101.0 kcal in usda_fndds vs 145.0 kcal in curated - ICMR / IFCT (Indian Food Composition Tables 2017) (35.8% difference). |

## 3. Flagged & Approximate Entries Sample

| Food Display Name | Source | Stated Kcal | P (g) | C (g) | F (g) | Audit Reason |
|---|---|---|---|---|---|---|
| Milk | usda_fndds | 52.0 | 3.33 | 4.83 | 2.14 | Fat/Oil energy 52.0 kcal below plausible range (>500) |
| Milk, reduced fat (2%) | usda_fndds | 50.0 | 3.36 | 4.9 | 1.9 | Fat/Oil energy 50.0 kcal below plausible range (>500) |
| Milk, low fat (1%) | usda_fndds | 43.0 | 3.38 | 5.18 | 0.95 | Fat/Oil energy 43.0 kcal below plausible range (>500) |
| Milk, fat free (skim) | usda_fndds | 34.0 | 3.43 | 4.92 | 0.08 | Fat/Oil energy 34.0 kcal below plausible range (>500) |
| Milk, lactose free, low fat (1%) | usda_fndds | 43.0 | 3.38 | 5.18 | 0.95 | Fat/Oil energy 43.0 kcal below plausible range (>500) |
| Milk, lactose free, fat free (skim) | usda_fndds | 34.0 | 3.43 | 4.92 | 0.08 | Fat/Oil energy 34.0 kcal below plausible range (>500) |
| Milk, lactose free, reduced fat (2%) | usda_fndds | 50.0 | 3.36 | 4.9 | 1.9 | Fat/Oil energy 50.0 kcal below plausible range (>500) |
| Kefir | usda_fndds | 52.0 | 3.59 | 7.48 | 0.96 | Fat/Oil energy 52.0 kcal below plausible range (>500) |
| Milk, dry, reconstituted, nonfat | usda_fndds | 32.0 | 3.2 | 4.6 | 0.07 | Fat/Oil energy 32.0 kcal below plausible range (>500) |
| Milk, evaporated, reduced fat (2%) | usda_fndds | 92.0 | 7.42 | 11.15 | 1.96 | Fat/Oil energy 92.0 kcal below plausible range (>500) |
| Milk, evaporated, fat free (skim) | usda_fndds | 78.0 | 7.55 | 11.35 | 0.2 | Fat/Oil energy 78.0 kcal below plausible range (>500) |
| Chocolate milk | usda_fndds | 65.0 | 3.44 | 10.98 | 0.83 | Fat/Oil energy 65.0 kcal below plausible range (>500) |
| Chocolate milk, reduced fat (2%) | usda_fndds | 76.0 | 2.99 | 12.13 | 1.9 | Fat/Oil energy 76.0 kcal below plausible range (>500) |
| Chocolate milk, fat free (skim) | usda_fndds | 67.0 | 3.39 | 13.46 | 0.0 | Fat/Oil energy 67.0 kcal below plausible range (>500) |
| Chocolate milk, low fat (1%) | usda_fndds | 64.0 | 3.46 | 10.15 | 1.11 | Fat/Oil energy 64.0 kcal below plausible range (>500) |
| Chocolate milk, reduced sugar | usda_fndds | 65.0 | 3.09 | 8.56 | 1.99 | Fat/Oil energy 65.0 kcal below plausible range (>500) |
| Hot chocolate / cocoa | usda_fndds | 72.0 | 1.82 | 13.9 | 1.04 | Fat/Oil energy 72.0 kcal below plausible range (>500) |
| Hot chocolate / cocoa, made with whole or reduced fat (2%) milk | usda_fndds | 91.0 | 2.73 | 16.53 | 1.54 | Fat/Oil energy 91.0 kcal below plausible range (>500) |
| Hot chocolate / cocoa, made with lowfat (1%) or fat free (skim) milk | usda_fndds | 78.0 | 2.79 | 16.55 | 0.06 | Fat/Oil energy 78.0 kcal below plausible range (>500) |
| Hot chocolate / cocoa, with whipped cream | usda_fndds | 101.0 | 2.7 | 16.25 | 2.8 | Fat/Oil energy 101.0 kcal below plausible range (>500) |
| Chocolate milk, Nesquik | usda_fndds | 74.0 | 3.41 | 10.09 | 2.15 | Fat/Oil energy 74.0 kcal below plausible range (>500) |
| Chocolate milk, reduced sugar, reduced fat (2%) | usda_fndds | 63.0 | 3.11 | 8.62 | 1.78 | Fat/Oil energy 63.0 kcal below plausible range (>500) |
| Chocolate milk, reduced sugar, low fat (1%) | usda_fndds | 57.0 | 3.13 | 8.87 | 0.95 | Fat/Oil energy 57.0 kcal below plausible range (>500) |
| Chocolate milk, reduced sugar, fat free (skim) | usda_fndds | 49.0 | 3.18 | 8.64 | 0.19 | Fat/Oil energy 49.0 kcal below plausible range (>500) |
| Hot chocolate / cocoa, dry mix, made with water | usda_fndds | 54.0 | 0.9 | 11.27 | 0.54 | Fat/Oil energy 54.0 kcal below plausible range (>500) |
| Hot chocolate / cocoa, dry mix, made with whole or reduced fat (2%) milk | usda_fndds | 97.0 | 3.81 | 15.51 | 2.18 | Fat/Oil energy 97.0 kcal below plausible range (>500) |
| Hot chocolate / cocoa, dry mix, made with lowfat (1%) or fat free (skim) milk | usda_fndds | 83.0 | 3.87 | 15.53 | 0.61 | Fat/Oil energy 83.0 kcal below plausible range (>500) |
| Hot chocolate / cocoa, dry mix, made with water, with whipped cream | usda_fndds | 65.0 | 0.94 | 11.2 | 1.83 | Fat/Oil energy 65.0 kcal below plausible range (>500) |
| Hot chocolate / cocoa, dry mix, reduced sugar, made with water | usda_fndds | 31.0 | 1.26 | 5.87 | 0.24 | Fat/Oil energy 31.0 kcal below plausible range (>500) |
| Hot chocolate / cocoa, dry mix, reduced sugar, made with whole or reduced fat (2%) milk | usda_fndds | 77.0 | 4.35 | 10.37 | 1.99 | Fat/Oil energy 77.0 kcal below plausible range (>500) |
| Hot chocolate / cocoa, reduced sugar, made with whole or reduced fat (2%) milk | usda_fndds | 69.0 | 2.99 | 10.44 | 1.73 | Fat/Oil energy 69.0 kcal below plausible range (>500) |
| Hot chocolate / cocoa, dry mix, reduced sugar, made with lowfat (1%) or fat free (skim) milk | usda_fndds | 62.0 | 4.41 | 10.39 | 0.32 | Fat/Oil energy 62.0 kcal below plausible range (>500) |
| Hot chocolate / cocoa, reduced sugar, made with lowfat (1%) or fat free (skim) milk | usda_fndds | 56.0 | 3.05 | 10.45 | 0.25 | Fat/Oil energy 56.0 kcal below plausible range (>500) |
| Strawberry milk | usda_fndds | 65.0 | 3.2 | 8.54 | 2.06 | Fat/Oil energy 65.0 kcal below plausible range (>500) |
| Strawberry milk, reduced fat (2%) | usda_fndds | 71.0 | 3.16 | 10.7 | 1.8 | Fat/Oil energy 71.0 kcal below plausible range (>500) |
