import { defineConfig } from 'vitest/config';

/**
 * Tests that need the Firebase emulators: the Firestore Security Rules and the Firebase
 * adapter. `npm run test:rules` starts the Auth and Firestore emulators and runs these.
 */
export default defineConfig({
  test: {
    name: 'firebase',
    environment: 'node',
    include: ['tests/firestore.rules.test.ts', 'src/client/**/*.emulator.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // The tests share one emulator; running files one at a time keeps them independent.
    fileParallelism: false,
  },
});
