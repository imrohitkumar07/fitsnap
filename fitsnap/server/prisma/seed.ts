/**
 * FitSnap - Database Seed Script
 * Seeds comprehensive exercise library and fully populated demo account (demo@fitsnap.app).
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const EXERCISES = [
  // ─── STRENGTH ─────────────────────────────────────────────
  { name: 'Barbell Bench Press', category: 'strength', muscleGroup: 'chest', metValue: 5.0, icon3d: 'dumbbell' },
  { name: 'Incline Dumbbell Press', category: 'strength', muscleGroup: 'chest', metValue: 5.0, icon3d: 'dumbbell' },
  { name: 'Dumbbell Chest Fly', category: 'strength', muscleGroup: 'chest', metValue: 4.5, icon3d: 'dumbbell' },
  { name: 'Push-Ups', category: 'strength', muscleGroup: 'chest', metValue: 4.0, icon3d: 'dumbbell' },
  { name: 'Barbell Squat', category: 'strength', muscleGroup: 'legs', metValue: 6.0, icon3d: 'kettlebell' },
  { name: 'Leg Press', category: 'strength', muscleGroup: 'legs', metValue: 5.0, icon3d: 'kettlebell' },
  { name: 'Walking Lunges', category: 'strength', muscleGroup: 'legs', metValue: 5.5, icon3d: 'kettlebell' },
  { name: 'Romanian Deadlift', category: 'strength', muscleGroup: 'legs', metValue: 6.0, icon3d: 'dumbbell' },
  { name: 'Conventional Deadlift', category: 'strength', muscleGroup: 'back', metValue: 6.5, icon3d: 'dumbbell' },
  { name: 'Barbell Bent-Over Row', category: 'strength', muscleGroup: 'back', metValue: 5.5, icon3d: 'dumbbell' },
  { name: 'Lat Pulldown', category: 'strength', muscleGroup: 'back', metValue: 4.8, icon3d: 'dumbbell' },
  { name: 'Seated Cable Row', category: 'strength', muscleGroup: 'back', metValue: 4.8, icon3d: 'dumbbell' },
  { name: 'Overhead Shoulder Press', category: 'strength', muscleGroup: 'shoulders', metValue: 5.0, icon3d: 'dumbbell' },
  { name: 'Dumbbell Lateral Raise', category: 'strength', muscleGroup: 'shoulders', metValue: 4.0, icon3d: 'dumbbell' },
  { name: 'Face Pulls', category: 'strength', muscleGroup: 'shoulders', metValue: 4.0, icon3d: 'dumbbell' },
  { name: 'Barbell Bicep Curl', category: 'strength', muscleGroup: 'arms', metValue: 4.0, icon3d: 'dumbbell' },
  { name: 'Hammer Curls', category: 'strength', muscleGroup: 'arms', metValue: 4.0, icon3d: 'dumbbell' },
  { name: 'Tricep Rope Pushdown', category: 'strength', muscleGroup: 'arms', metValue: 4.0, icon3d: 'dumbbell' },
  { name: 'Dips', category: 'strength', muscleGroup: 'arms', metValue: 5.0, icon3d: 'dumbbell' },
  { name: 'Plank', category: 'strength', muscleGroup: 'core', metValue: 3.5, icon3d: 'mat' },
  { name: 'Hanging Leg Raise', category: 'strength', muscleGroup: 'core', metValue: 4.5, icon3d: 'mat' },
  { name: 'Russian Twist', category: 'strength', muscleGroup: 'core', metValue: 4.0, icon3d: 'mat' },

  // ─── CARDIO ───────────────────────────────────────────────
  { name: 'Outdoor Running (Moderate)', category: 'cardio', muscleGroup: 'full', metValue: 9.8, icon3d: 'shoe' },
  { name: 'Treadmill Jogging', category: 'cardio', muscleGroup: 'legs', metValue: 8.0, icon3d: 'shoe' },
  { name: 'Outdoor Cycling', category: 'cardio', muscleGroup: 'legs', metValue: 7.5, icon3d: 'shoe' },
  { name: 'Stationary Bike', category: 'cardio', muscleGroup: 'legs', metValue: 6.8, icon3d: 'shoe' },
  { name: 'Jump Rope', category: 'cardio', muscleGroup: 'full', metValue: 11.0, icon3d: 'shoe' },
  { name: 'Swimming (Freestyle)', category: 'cardio', muscleGroup: 'full', metValue: 8.0, icon3d: 'shoe' },
  { name: 'Rowing Machine', category: 'cardio', muscleGroup: 'full', metValue: 7.0, icon3d: 'shoe' },
  { name: 'Brisk Walking', category: 'cardio', muscleGroup: 'legs', metValue: 3.8, icon3d: 'shoe' },
  { name: 'HIIT Circuit', category: 'cardio', muscleGroup: 'full', metValue: 8.5, icon3d: 'shoe' },

  // ─── YOGA & STRETCHING ────────────────────────────────────
  { name: 'Surya Namaskar (Sun Salutation)', category: 'yoga', muscleGroup: 'full', metValue: 4.0, icon3d: 'mat' },
  { name: 'Vinyasa Flow Yoga', category: 'yoga', muscleGroup: 'full', metValue: 3.5, icon3d: 'mat' },
  { name: 'Hatha Yoga', category: 'yoga', muscleGroup: 'full', metValue: 2.5, icon3d: 'mat' },
  { name: 'Deep Stretching & Mobility', category: 'yoga', muscleGroup: 'full', metValue: 2.3, icon3d: 'mat' },

  // ─── SPORTS ───────────────────────────────────────────────
  { name: 'Badminton (Casual/Match)', category: 'sports', muscleGroup: 'full', metValue: 5.5, icon3d: 'shoe' },
  { name: 'Cricket (Batting/Bowling)', category: 'sports', muscleGroup: 'full', metValue: 5.0, icon3d: 'shoe' },
  { name: 'Football / Soccer', category: 'sports', muscleGroup: 'full', metValue: 8.0, icon3d: 'shoe' },
  { name: 'Tennis', category: 'sports', muscleGroup: 'full', metValue: 7.3, icon3d: 'shoe' },
  { name: 'Basketball', category: 'sports', muscleGroup: 'full', metValue: 6.5, icon3d: 'shoe' },
];

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Seed Exercises
  for (const ex of EXERCISES) {
    const existing = await prisma.exerciseLibrary.findFirst({
      where: { name: ex.name },
    });

    if (!existing) {
      await prisma.exerciseLibrary.create({
        data: {
          name: ex.name,
          category: ex.category,
          muscleGroup: ex.muscleGroup,
          metValue: ex.metValue,
          icon3d: ex.icon3d,
          isCustom: false,
        },
      });
    }
  }
  console.log(`✅ Seeded ${EXERCISES.length} exercises into library.`);

  // 2. Seed Demo Account
  const demoEmail = 'demo@fitsnap.app';
  let demoUser = await prisma.user.findUnique({
    where: { email: demoEmail },
  });

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('password123', salt);

  if (!demoUser) {
    demoUser = await prisma.user.create({
      data: {
        email: demoEmail,
        passwordHash,
      },
    });
    console.log(`✅ Created demo user: ${demoEmail}`);
  }

  // 3. Seed Demo Profile
  await prisma.profile.upsert({
    where: { userId: demoUser.id },
    update: {
      name: 'Aarav Sharma',
      age: 28,
      gender: 'male',
      heightCm: 178,
      weightKg: 74.5,
      activityLevel: 'moderate',
      goal: 'maintain',
      bmr: 1720,
      tdee: 2360,
    },
    create: {
      userId: demoUser.id,
      name: 'Aarav Sharma',
      age: 28,
      gender: 'male',
      heightCm: 178,
      weightKg: 74.5,
      activityLevel: 'moderate',
      goal: 'maintain',
      bmr: 1720,
      tdee: 2360,
    },
  });

  // 4. Seed Active Goal
  const existingGoal = await prisma.goal.findFirst({
    where: { userId: demoUser.id, isActive: true },
  });

  if (!existingGoal) {
    await prisma.goal.create({
      data: {
        userId: demoUser.id,
        calories: 2200,
        proteinG: 140,
        carbsG: 230,
        fatG: 65,
        waterMl: 2500,
        isActive: true,
      },
    });
  }

  // 5. Seed Today's Food Logs if empty
  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);

  const existingLogsToday = await prisma.foodLog.count({
    where: { userId: demoUser.id, date: { gte: startOfDay } },
  });

  if (existingLogsToday === 0) {
    // Breakfast
    await prisma.foodLog.create({
      data: {
        userId: demoUser.id,
        mealType: 'breakfast',
        date: new Date(Date.now() - 4 * 3600 * 1000), // 4h ago
        photoUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
        items: {
          create: [
            {
              name: 'Rolled Oatmeal with Almond Milk & Berries',
              portionG: 220,
              portionLabel: '1 bowl (220g)',
              calories: 320,
              proteinG: 11.5,
              carbsG: 52.0,
              fatG: 6.5,
              fiberG: 5.5,
              confidence: 0.96,
            },
            {
              name: 'Boiled Egg Whites',
              portionG: 66,
              portionLabel: '2 whites',
              calories: 34,
              proteinG: 7.2,
              carbsG: 0.4,
              fatG: 0.2,
              fiberG: 0,
              confidence: 0.99,
            },
          ],
        },
      },
    });

    // Lunch
    await prisma.foodLog.create({
      data: {
        userId: demoUser.id,
        mealType: 'lunch',
        date: new Date(Date.now() - 1 * 3600 * 1000), // 1h ago
        photoUrl: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=400&q=80',
        items: {
          create: [
            {
              name: 'Paneer Tikka Masala',
              portionG: 200,
              portionLabel: '1 katori (200g)',
              calories: 340,
              proteinG: 18.0,
              carbsG: 12.0,
              fatG: 24.0,
              fiberG: 3.0,
              confidence: 0.97,
            },
            {
              name: 'Whole Wheat Roti',
              portionG: 60,
              portionLabel: '2 rotis',
              calories: 170,
              proteinG: 6.4,
              carbsG: 35.0,
              fatG: 1.2,
              fiberG: 5.0,
              confidence: 0.98,
            },
            {
              name: 'Kachumber Salad (Cucumber & Tomato)',
              portionG: 100,
              portionLabel: '1 small bowl',
              calories: 35,
              proteinG: 1.2,
              carbsG: 6.5,
              fatG: 0.3,
              fiberG: 2.0,
              confidence: 0.94,
            },
          ],
        },
      },
    });

    // Water logs
    await prisma.waterLog.createMany({
      data: [
        { userId: demoUser.id, amountMl: 500, date: new Date(Date.now() - 5 * 3600 * 1000) },
        { userId: demoUser.id, amountMl: 500, date: new Date(Date.now() - 3 * 3600 * 1000) },
        { userId: demoUser.id, amountMl: 250, date: new Date(Date.now() - 1 * 3600 * 1000) },
      ],
    });

    // Weight log
    await prisma.weightLog.create({
      data: {
        userId: demoUser.id,
        weightKg: 74.5,
        date: new Date(),
      },
    });

    console.log('✅ Seeded demo food, water, and weight logs.');
  }

  console.log('🎉 Seed complete! Demo account is ready.');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
