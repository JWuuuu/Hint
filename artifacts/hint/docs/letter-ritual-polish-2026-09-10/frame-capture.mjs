import { webkit, expect } from '/Users/jwu/Documents/Hint-main/artifacts/hint/node_modules/@playwright/test/index.mjs';
import { writeFile } from 'node:fs/promises';

const browser = await webkit.launch();
const context = await browser.newContext({ viewport:{width:640,height:1080}, hasTouch:true, reducedMotion:'no-preference' });
await context.route('**/api/**',route=>route.fulfill({status:503,json:{error:'ISOLATED_FRAME_SCREENSHOT'}}));
await context.addInitScript(() => {
  const originalGet = Storage.prototype.getItem;
  Storage.prototype.getItem = function(key) {
    if (key.startsWith('hint_device_session_v1:') && originalGet.call(this,key)===null) {
      this.setItem(key,JSON.stringify({token:'isolated-fixture-token-000000000000000000000000000000',ownerId:'isolated-server-owner',expiresAt:'2099-01-01T00:00:00Z'}));
    }
    return originalGet.call(this,key);
  };
  localStorage.setItem('hint_anon_id','letter-frame-fictional');
  localStorage.setItem('hint_onboarding_complete_v3','1');
  localStorage.setItem('hint_launch_seen_v2','1');
  localStorage.setItem('hint-language','en');
  localStorage.setItem('hint-theme','bright');
});
await context.route('**/api/tarot/spread-recommendation',route=>route.fulfill({status:200,json:{
  spreadType:'three',reason:'Three moments to notice what is opening, what is asking for care, and where to begin.',
  focusLabel:'A little space for yourself',confidence:'high',source:'api',
}}));
const page = await context.newPage();
await page.goto('http://127.0.0.1:5219/app/tarot?hintPreview=frame');
const phone = page.frameLocator('iframe.hint-preview-screen');
await phone.getByPlaceholder('Type your question...').fill('What can I make room for today?');
await phone.getByRole('button',{name:'Next',exact:true}).click();
await expect(phone.locator('[data-spread-preview="three"]')).toBeVisible();
await page.waitForTimeout(500);
const metadata = { source:'http://127.0.0.1:5219/app/tarot?hintPreview=frame', environment:'Production WebKit browser screenshot with actual Hint DevicePreview hardware frame; independent fictional context, all APIs503 except fictional local spread recommendation. No user browser or real records accessed.', screenshots:[] };
await page.screenshot({path:'/tmp/hint-letter-20260910/frame-evidence/pro-max-personal-spread.png'});
metadata.screenshots.push({file:'pro-max-personal-spread.png',image:{width:640,height:1080},device:'iPhone 17 Pro Max',screen:{width:440,height:956},frame:await page.locator('iframe.hint-preview-screen').boundingBox()});
await page.getByLabel('Preview device').selectOption('iphone-se');
await page.setViewportSize({width:640,height:820});
await expect(page.locator('iframe.hint-preview-screen')).toHaveAttribute('title','iPhone SE preview');
const useSpread = phone.getByRole('button',{name:/Use this spread/i});
await useSpread.scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
const geometry = await useSpread.evaluate(button => {
  const r=button.getBoundingClientRect();
  return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height,viewport:{width:innerWidth,height:innerHeight}};
});
if(geometry.top<0 || geometry.bottom>geometry.viewport.height || geometry.left<0 || geometry.right>geometry.viewport.width) throw new Error('SE action is not fully visible: '+JSON.stringify(geometry));
await page.screenshot({path:'/tmp/hint-letter-20260910/frame-evidence/se-personal-spread-bottom.png'});
metadata.screenshots.push({file:'se-personal-spread-bottom.png',image:{width:640,height:820},device:'iPhone SE',screen:{width:375,height:667},frame:await page.locator('iframe.hint-preview-screen').boundingBox(),useSpread:geometry});
await writeFile('/tmp/hint-letter-20260910/frame-evidence/metadata.json',JSON.stringify(metadata,null,2));
await context.close();
await browser.close();
