import { defineConfig } from "/Users/jwu/Documents/Hint-main/artifacts/hint/node_modules/@playwright/test";
import base from "/Users/jwu/Documents/Hint-main/artifacts/hint/playwright.config";
export default defineConfig({...base,testDir:"/Users/jwu/Documents/Hint-main/artifacts/hint/e2e",outputDir:"/tmp/hint-me-entrances-20260910/final-results",webServer:undefined,use:{...base.use,baseURL:"http://127.0.0.1:5205"},reporter:[["list"],["json",{outputFile:"/tmp/hint-me-entrances-20260910/final-e2e.json"}]]});
