/**
 * FitSnap - Bilingual i18n Translation Dictionary
 * Comprehensive English (en) and Hindi (hi) language localization.
 */

import { useSettingsStore } from '../store/settingsStore';

export type Language = 'en' | 'hi';

export const translations = {
  en: {
    // Navigation
    nav_dashboard: 'Dashboard',
    nav_food: 'Food Diary',
    nav_water: 'Hydration',
    nav_workouts: 'Workouts',
    nav_history: 'History & Trends',
    nav_coach: 'AI Coach',
    nav_profile: 'Profile & Goals',
    nav_settings: 'Settings',

    // Dashboard
    dash_welcome: 'Welcome back',
    dash_net_calories: 'Net Calories',
    dash_target: 'Target',
    dash_eaten: 'Eaten',
    dash_burned: 'Burned',
    dash_remaining: 'Remaining',
    dash_protein: 'Protein',
    dash_carbs: 'Carbs',
    dash_fat: 'Fat',
    dash_water: 'Water',
    dash_streak: 'Day Streak',
    dash_quick_actions: 'Quick Log',

    // Food Logging
    food_snap_meal: 'Snap Meal with AI',
    food_search_placeholder: 'Search Indian & Western dishes...',
    food_barcode: 'Scan Barcode',
    food_voice: 'Voice Log',
    food_breakfast: 'Breakfast',
    food_lunch: 'Lunch',
    food_dinner: 'Dinner',
    food_snack: 'Snacks',
    food_confidence: 'AI Confidence',
    food_portion: 'Portion size',

    // Hydration
    water_title: 'Hydration Tracker',
    water_quick_add: 'Quick Add',
    water_history: 'Today’s Log',
    water_undo: 'Undo Last',

    // Settings
    settings_title: 'App Settings',
    settings_graphics: 'Graphics & Performance',
    settings_reduce_3d: 'Reduce 3D Effects',
    settings_reduce_3d_desc: 'Swaps 3D scenes for lightweight 2D charts and saves battery on mobile devices.',
    settings_dark_mode: 'OLED Dark Mode',
    settings_dark_mode_desc: 'Deep black backdrop with high-contrast text and crisp borders.',
    settings_language: 'Language / भाषा',
    settings_units: 'Measurement Units',
    settings_metric: 'Metric (kg, cm, ml)',
    settings_imperial: 'Imperial (lbs, in, fl oz)',
    settings_reminders: 'Reminders & Notifications',
    settings_quiet_hours: 'Quiet Hours',
    settings_test_notif: 'Send Test Notification',

    // Common Actions
    save: 'Save Changes',
    cancel: 'Cancel',
    delete: 'Delete',
    done: 'Done',
    loading: 'Loading...',
    success: 'Updated successfully',
  },
  hi: {
    // Navigation
    nav_dashboard: 'डैशबोर्ड',
    nav_food: 'भोजन डायरी',
    nav_water: 'जल ट्रैकर',
    nav_workouts: 'वर्कआउट',
    nav_history: 'इतिहास और रुझान',
    nav_coach: 'एआई कोच',
    nav_profile: 'प्रोफ़ाइल और लक्ष्य',
    nav_settings: 'सेटिंग्स',

    // Dashboard
    dash_welcome: 'स्वागत है',
    dash_net_calories: 'कुल कैलोरी',
    dash_target: 'लक्ष्य',
    dash_eaten: 'खाया',
    dash_burned: 'जलाया',
    dash_remaining: 'शेष',
    dash_protein: 'प्रोटीन',
    dash_carbs: 'कार्ब्स',
    dash_fat: 'वसा',
    dash_water: 'पानी',
    dash_streak: 'दिनों की स्ट्रीक',
    dash_quick_actions: 'त्वरित लॉग',

    // Food Logging
    food_snap_meal: 'फोटो से भोजन पहचानें',
    food_search_placeholder: 'भारतीय और पश्चिमी व्यंजन खोजें...',
    food_barcode: 'बारकोड स्कैन करें',
    food_voice: 'आवाज से लॉग करें',
    food_breakfast: 'नाश्ता',
    food_lunch: 'दोपहर का भोजन',
    food_dinner: 'रात का खाना',
    food_snack: 'स्नैक्स',
    food_confidence: 'एआई सटीकता',
    food_portion: 'मात्रा',

    // Hydration
    water_title: 'दैनिक जल सेवन',
    water_quick_add: 'त्वरित जोड़ें',
    water_history: 'आज का विवरण',
    water_undo: 'अंतिम प्रविष्टि हटाएं',

    // Settings
    settings_title: 'ऐप सेटिंग्स',
    settings_graphics: 'ग्राफिक्स और प्रदर्शन',
    settings_reduce_3d: '3D प्रभाव कम करें',
    settings_reduce_3d_desc: 'हल्के 2D चार्ट का उपयोग करें और मोबाइल बैटरी बचाएं।',
    settings_dark_mode: 'डार्क मोड',
    settings_dark_mode_desc: 'आँखों के लिए आरामदायक डार्क थीम।',
    settings_language: 'भाषा (Language)',
    settings_units: 'माप की इकाइयां',
    settings_metric: 'मीट्रिक (किग्रा, सेमी, मिली)',
    settings_imperial: 'इंपीरियल (पाउंड, इंच, औंस)',
    settings_reminders: 'अनुस्मारक और सूचनाएं',
    settings_quiet_hours: 'शांत समय (Quiet Hours)',
    settings_test_notif: 'परीक्षण सूचना भेजें',

    // Common Actions
    save: 'परिवर्तन सहेजें',
    cancel: 'रद्द करें',
    delete: 'हटाएं',
    done: 'पूर्ण',
    loading: 'लोड हो रहा है...',
    success: 'सफलतापूर्वक अपडेट किया गया',
  },
};

export type TranslationKey = keyof typeof translations.en;

/**
 * React hook to get translated text strings according to current user setting.
 */
export function useTranslation() {
  const language = useSettingsStore((s) => s.language) || 'en';

  const t = (key: TranslationKey, fallback?: string): string => {
    const langDict = translations[language] || translations.en;
    return langDict[key] || translations.en[key] || fallback || key;
  };

  return { t, language };
}
