import { defineConfig } from '/tmp/hint-pearlmoon-20260910/candidate/artifacts/hint/node_modules/@playwright/test/index.mjs';
import candidate from './playwright.candidate.config';
export default defineConfig({ ...candidate, workers: 1, grep:/Astrology host frame samples|web frame regression/,
  outputDir:'/tmp/hint-pearlmoon-20260910/performance-e2e-results',
  reporter:[['list'],['json',{outputFile:'/tmp/hint-pearlmoon-20260910/performance-e2e.json'}]],
});
