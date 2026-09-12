import { defineConfig } from '/tmp/hint-pearlmoon-20260910/candidate/artifacts/hint/node_modules/@playwright/test/index.mjs';
import candidate from './playwright.candidate.config';
export default defineConfig({ ...candidate, workers: 2,
  grepInvert: /development preview|native packaging files cannot reload|Astrology host frame samples|web frame regression/,
  outputDir:'/tmp/hint-pearlmoon-20260910/functional-e2e-results',
  reporter:[['list'],['json',{outputFile:'/tmp/hint-pearlmoon-20260910/functional-e2e.json'}]],
});
