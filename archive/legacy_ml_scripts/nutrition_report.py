import json

with open('ml/class_map.json', 'r', encoding='utf-8') as f:
    cmap = json.load(f)

usda_classes = []
curated_classes = []

for k, v in cmap.items():
    if v.get('source') == 'usda' or (v.get('fdc_id') is not None and str(v.get('fdc_id')).strip() != ''):
        usda_classes.append((k, v.get('display_name'), v.get('fdc_id'), v.get('per_100g', {})))
    else:
        curated_classes.append((k, v.get('display_name'), v.get('per_100g', {})))

print(f"Total Unified Classes: {len(cmap)}")
print(f"• Verified USDA FNDDS Classes: {len(usda_classes)} ({len(usda_classes)/len(cmap)*100:.1f}%)")
print(f"• Curated Cultural / Regional Classes: {len(curated_classes)} ({len(curated_classes)/len(cmap)*100:.1f}%)")

print("\n" + "=" * 80)
print(f"CURATED CLASSES TO VERIFY ({len(curated_classes)} classes)")
print("=" * 80)
for idx, (c, dname, p) in enumerate(curated_classes):
    cal = p.get('calories_kcal')
    prot = p.get('protein_g')
    carb = p.get('carbs_g')
    fat = p.get('fat_g')
    fib = p.get('fiber_g', 0)
    print(f"{idx+1:03d}. {c:<32} | {dname:<28} | {cal:5.1f} kcal | P: {prot:4.1f}g | C: {carb:4.1f}g | F: {fat:4.1f}g")
