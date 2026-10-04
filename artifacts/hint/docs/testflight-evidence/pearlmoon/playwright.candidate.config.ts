import { defineConfig } from '/tmp/hint-pearlmoon-20260910/candidate/artifacts/hint/node_modules/@playwright/test/index.mjs';
import phoneConfig from '/tmp/hint-pearlmoon-20260910/candidate/artifacts/hint/playwright.config';
export default defineConfig({
 ...phoneConfig,
 testDir: '/tmp/hint-pearlmoon-20260910/candidate/artifacts/hint/e2e',
 outputDir: '/tmp/hint-pearlmoon-20260910/candidate-e2e-results',
 reporter: [['list'], ['json', {outputFile:'/tmp/hint-pearlmoon-20260910/candidate-e2e.json'}]],
 use: {...phoneConfig.use, baseURL:'http://127.0.0.1:5200'},
 grepInvert: /development preview|native packaging files cannot reload/,
 webServer: {command:'API_PROXY_TARGET=http://127.0.0.1:1 PORT=5200 node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --strictPort',cwd:'/tmp/hint-pearlmoon-20260910/candidate/artifacts/hint',url:'http://127.0.0.1:5200',reuseExistingServer:false,timeout:120000}
});
