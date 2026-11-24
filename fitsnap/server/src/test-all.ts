/**
 * FitSnap - Master Test Runner
 * Executes all automated verification suites (Phases 4 through 11) in sequence,
 * reporting a unified summary of test assertions and feature verification.
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const suites = [
  { name: 'Model Checkpoint Presence & Weight Integrity Guard', script: 'src/test-checkpoints.ts' },
  { name: 'End-to-End Real Photo Scanner, Confidence & Diary Dashboard Flow', script: 'src/test-full-app-flow.ts' },
  { name: 'Deterministic Voice & Hinglish Meal Parser (32 Test Cases)', script: 'src/test-voice-parser.ts' },
  { name: 'Phase 4: Core Backend, Expanded Prisma Schema & Auth', script: 'src/test-phase4.ts' },
  { name: 'Phase 5: Food Diary & 4 Logging Methods (Photo, Barcode, Voice, Search)', script: 'src/test-phase5.ts' },
  { name: 'Phase 6: Water, Exercise, Cardio MET & Activity', script: 'src/test-phase6.ts' },
  { name: 'Phase 7: Progress, Reports, AI Insights & 3D Dashboard', script: 'src/test-phase7.ts' },
  { name: 'Phase 8: 7-Day Meal Planner & Grocery List', script: 'src/test-phase8.ts' },
  { name: 'Phase 9: Settings, Notifications, Quiet Hours & Hindi i18n', script: 'src/test-phase9.ts' },
  { name: 'Phase 10: Social Community Boards, Challenges & Admin Moderation', script: 'src/test-phase10.ts' },
  { name: 'Phase 11: Production Health Probes, Docker & Backups', script: 'src/test-phase11.ts' },
];

async function runMasterSuite() {
  console.log('\n================================================================');
  console.log('🌟 FITSNAP MASTER AUTOMATED TEST RUNNER (ALL PHASES)');
  console.log('================================================================\n');

  let passedSuites = 0;
  const startTime = Date.now();

  for (const suite of suites) {
    console.log(`\n▶️  Executing: ${suite.name}...`);
    try {
      execSync(`npx tsx ${suite.script}`, {
        cwd: path.resolve(__dirname, '..'),
        stdio: 'inherit',
      });
      passedSuites++;
      console.log(`✨ PASSED: ${suite.name}`);
    } catch (err: any) {
      console.error(`💥 FAILED: ${suite.name}`);
      process.exit(1);
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n================================================================');
  console.log(`🏁 MASTER SUITE COMPLETE: ${passedSuites} / ${suites.length} SUITES PASSED (${durationSec}s)`);
  console.log('🎉 100% OF END-TO-END VERIFICATION CHECKS SUCCESSFUL!');
  console.log('================================================================\n');
}

runMasterSuite();
