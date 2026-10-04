import {defineConfig} from '/tmp/hint-pearlmoon-20260910/candidate/artifacts/hint/node_modules/@playwright/test/index.mjs';
import candidate from './playwright.candidate.config';
export default defineConfig({...candidate,workers:1,
 grep:/voice completion keeps|pick arc stays ordered|reading layout [13579] cards/,
 outputDir:'/tmp/hint-pearlmoon-20260910/snapshot-e2e-results',
 reporter:[['list'],['json',{outputFile:'/tmp/hint-pearlmoon-20260910/snapshot-e2e.json'}]],
 use:{...candidate.use,baseURL:'http://127.0.0.1:5202'},
 webServer:{...candidate.webServer,command:'API_PROXY_TARGET=http://127.0.0.1:1 PORT=5202 node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --strictPort',url:'http://127.0.0.1:5202'}
});
