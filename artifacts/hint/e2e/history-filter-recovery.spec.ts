import { test, expect, type Page } from './fixtures';
import AxeBuilder from '@axe-core/playwright';

const owner = 'h18-fictional-history';
const fixedTime = '2026-11-10T12:00:00Z';
const remote = (id: string, spreadType = 'three') => ({ id, cardName: 'Fictional saved spread', whisper: `Fictional reflection ${id}`, spreadType, question: null, territory: 'tarot', createdAt: fixedTime });

test.beforeEach(async ({ context, page, baseURL }) => {
  // Local app assets only; every API request below is deterministic and fictional.
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== new URL(baseURL!).origin) return route.abort();
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, json: { error: 'ISOLATED_HISTORY_TEST' } });
    return route.continue();
  });
  await page.clock.setFixedTime(new Date(fixedTime));
  await page.addInitScript(({ owner }) => {
    localStorage.setItem('hint_anon_id', owner);
    localStorage.setItem('hint_onboarding_complete_v3', '1');
    localStorage.setItem('hint.preferences.v1', JSON.stringify({reduceMotion:true,soundAndHaptics:false}));
  }, { owner });
  await page.route('**/api/profile**', route => route.fulfill({ json: null }));
  await page.route('**/api/readings**', route => route.fulfill({ json: [] }));
});

async function open(page: Page, language = 'en', theme = 'bright', scale = 100) {
  await page.addInitScript(({language,theme}) => {
    localStorage.setItem('hint-language',language); localStorage.setItem('hint-theme',theme);
  }, {language,theme});
  await page.goto('/app/readings?hintPreview=embedded');
  await expect(page.locator('.hr-filter')).toHaveCount(5);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(scale => document.documentElement.style.fontSize = `${16 * scale / 100}px`,scale);
  await expect(page.locator('.hr-loading')).toHaveCount(0);
}

async function assertExposed(page: Page, index: number) {
  await expect.poll(() => page.locator('.hr-filter').nth(index).evaluate(button => {
    const b=button.getBoundingClientRect(), row=button.parentElement!.getBoundingClientRect();
    const edges=[...document.querySelectorAll('.hr-filter-edge')].map(el=>el.getBoundingClientRect());
    const nav=document.querySelector('nav')?.getBoundingClientRect();
    const covers = edges.some(e => b.left < e.right-1 && b.right > e.left+1 && b.top < e.bottom && b.bottom > e.top);
    return {horizontal:b.left>=row.left-1 && b.right<=row.right+1, vertical:b.top>=0 && b.bottom<=(nav?.top ?? innerHeight), clearOfEdges:!covers};
  }),{message:`filter ${index} must be fully exposed`}).toEqual({horizontal:true,vertical:true,clearOfEdges:true});
}

async function assertEdgeTargets(page: Page) {
  const edges = page.locator('.hr-filter-edge');
  for (let i = 0; i < await edges.count(); i++) {
    // Make the real button reachable vertically before checking actual hit
    // surfaces; a below-row control may initially be below the viewport.
    await edges.nth(i).scrollIntoViewIfNeeded();
    const target = await edges.nth(i).evaluate(el => {
      const r = el.getBoundingClientRect();
      const points = [[r.left + 1, r.top + r.height / 2], [r.right - 1, r.top + r.height / 2], [r.left + r.width / 2, r.top + 1], [r.left + r.width / 2, r.bottom - 1], [r.left + r.width / 2, r.top + r.height / 2]];
      return { width:r.width, height:r.height, hits:points.map(([x,y]) => el.contains(document.elementFromPoint(x,y))), label:el.getAttribute('aria-label') };
    });
    expect(target.width, `${target.label}: actual target width`).toBeGreaterThanOrEqual(44);
    expect(target.height, `${target.label}: actual target height`).toBeGreaterThanOrEqual(44);
    expect(target.hits, `${target.label}: center and all four edge-axis hit tests`).toEqual([true,true,true,true,true]);
  }
}

for (const width of [360,375,390,440]) for (const theme of ['bright','dark']) for (const scale of [100,200]) for (const language of ['en','es','ja','zh','ko']) {
  test(`filters ${width} ${theme} ${scale}% ${language}`, async ({page}, info) => {
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.setViewportSize({width,height:width===440?956:667});
    await open(page,language,theme,scale);
    const filters=page.locator('.hr-filter');
    const metrics=await page.locator('.hr-filters').evaluate(row=>({scrollWidth:row.scrollWidth,clientWidth:row.clientWidth,rect:row.getBoundingClientRect().toJSON(),buttons:[...row.children].map(b=>({text:b.textContent,rect:b.getBoundingClientRect().toJSON()}))}));
    await info.attach('resting-geometry',{body:JSON.stringify(metrics,null,2),contentType:'application/json'});
    if(metrics.scrollWidth>metrics.clientWidth+1) await expect(page.locator('.hr-filter-edge[data-direction="next"]')).toBeVisible();
    await assertEdgeTargets(page);
    if(language==='en' || language==='ja') await page.screenshot({path:info.outputPath('initial.png')});
    // Follow native tab order through all five choices, then return in reverse.
    await filters.first().focus();
    for(let i=0;i<5;i++) {
      await expect(filters.nth(i)).toBeFocused();
      await assertExposed(page,i);
      await page.keyboard.press(i%2?'Space':'Enter');
      await expect(filters.nth(i)).toHaveAttribute('aria-pressed','true');
      await expect(page.locator('.hr-filter[aria-pressed="true"]')).toHaveCount(1);
      expect(await filters.nth(i).evaluate(b=>({style:getComputedStyle(b).outlineStyle,width:getComputedStyle(b).outlineWidth}))).toEqual({style:'solid',width:'2px'});
      if(i<4)await page.keyboard.press('Tab');
    }
    await info.attach('selected-accessibility-tree',{body:await page.locator('.hr-filters').ariaSnapshot(),contentType:'text/plain'});
    if(language==='en' || language==='ja') await page.screenshot({path:info.outputPath('questions-focused.png')});
    for(let i=3;i>=0;i--) {await page.keyboard.press('Shift+Tab');await expect(filters.nth(i)).toBeFocused();await assertExposed(page,i);}
    // Tap overflow controls without programmatic scrolling. Each tap focuses the
    // next revealed choice without changing which filter is selected.
    await filters.first().tap();
    for(let step=0;step<8 && await page.locator('.hr-filter-edge[data-direction="next"]').count();step++) {
      await assertEdgeTargets(page);
      await page.locator('.hr-filter-edge[data-direction="next"]').tap();
    }
    await assertExposed(page,4);await filters.last().tap();
    await expect(filters.last()).toHaveAttribute('aria-pressed','true');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    await filters.first().focus();await page.keyboard.press('Enter');
    // The final History shortcut must remain reachable above fixed navigation.
    const lastLink=page.locator('.hr-page a').last();await lastLink.focus();
    // Long translated shortcut copy can exceed one viewport at 200%. Check
    // both ends by scrolling, rather than requiring the whole article at once.
    await expect.poll(()=>lastLink.evaluate(el=>{const r=el.getBoundingClientRect();const nav=document.querySelector('nav')!.getBoundingClientRect();return r.bottom>0 && r.bottom<=nav.top;})).toBe(true);
    await lastLink.evaluate(el=>el.scrollIntoView({block:'start'}));
    await expect.poll(()=>lastLink.evaluate(el=>{const r=el.getBoundingClientRect();const nav=document.querySelector('nav')!.getBoundingClientRect();return r.top>=0 && r.top<nav.top;})).toBe(true);
  });
}

for (const language of ['en','ja']) for (const theme of ['bright','dark']) {
  test(`44px controls with long counts ${language} ${theme}`, async ({page},info) => {
    await page.setViewportSize({width:360,height:667});
    // Deterministic API fixture with four-digit counters, not edited DOM text.
    await page.route('**/api/readings**',route=>route.fulfill({json:Array.from({length:1234},(_,i)=>remote(`count-${i}`))}));
    await open(page,language,theme,200);
    await expect(page.locator('.hr-filter-count').first()).toHaveText('1234');
    await expect(page.locator('.hr-filter-strip')).toHaveAttribute('data-controls-below','true');
    await page.locator('.hr-filter').first().focus();
    for(let i=0;i<5;i++) {
      await assertExposed(page,i);
      await assertEdgeTargets(page);
      if(i<4) await page.keyboard.press('Tab');
    }
    await page.screenshot({path:info.outputPath('long-counts-44px.png')});
    // Return using the real left/right target edges, proving their enlarged
    // pointer area dispatches the action rather than just drawing a bigger box.
    for(let step=0;step<8 && await page.locator('.hr-filter-edge[data-direction="previous"]').count();step++) {
      const control=page.locator('.hr-filter-edge[data-direction="previous"]');
      await assertEdgeTargets(page);
      const box=(await control.boundingBox())!;
      await page.touchscreen.tap(box.x+1,box.y+box.height/2);
    }
    await assertExposed(page,0);
    for(let step=0;step<8 && await page.locator('.hr-filter-edge[data-direction="next"]').count();step++) {
      const control=page.locator('.hr-filter-edge[data-direction="next"]');
      await assertEdgeTargets(page);
      const box=(await control.boundingBox())!;
      await page.touchscreen.tap(box.x+box.width-1,box.y+box.height/2);
    }
    await assertExposed(page,4);
  });
}

test('touch swipes work in both directions and filter controls pass scoped axe checks',async({page,context},info)=>{
  await page.setViewportSize({width:375,height:667});await open(page);
  const cdp=await context.newCDPSession(page);
  const swipe=async(from:number,to:number)=>{
    const box=(await page.locator('.hr-filters').boundingBox())!;const y=box.y+box.height/2;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:from,y}]});
    for(let n=1;n<=15;n++) {await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from+(to-from)*n/15,y}]});await page.waitForTimeout(16);}
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  };
  await swipe(310,80);
  await assertExposed(page,4);
  await page.locator('.hr-filter').last().tap();
  await expect(page.locator('.hr-filter').last()).toHaveAttribute('aria-pressed','true');
  await swipe(80,310);await assertExposed(page,0);
  const reports=[];
  for(const theme of ['bright','dark']) {
    await open(page,'en',theme);
    await expect(page.locator('.hint-app-shell-root')).toHaveAttribute('data-hint-theme',theme);
    const report=await new AxeBuilder({page}).include('.hr-filter-strip').analyze();
    reports.push({theme,violations:report.violations,incomplete:report.incomplete});
    expect(report.violations).toEqual([]);
  }
  await info.attach('scoped-axe',{body:JSON.stringify(reports,null,2),contentType:'application/json'});
});

test('local updates and API refresh retain the selected filter and deduplicate records', async ({page}) => {
  let rows=[remote('server-tarot'),remote('server-daily','daily-pull')];
  await page.route('**/api/readings**',route=>route.fulfill({json:rows}));
  await open(page);
  await page.getByRole('button',{name:/^Daily/}).click();
  await expect(page.locator('.hr-entry')).toHaveCount(1);
  await page.evaluate(({owner,fixedTime})=>{
    localStorage.setItem('hint_local_daily_readings',JSON.stringify([{id:'server-daily',anonId:owner,source:'daily-pull',cardName:'The Star',whisper:'Fictional local duplicate',spreadType:'daily-pull',question:null,territory:'daily',createdAt:fixedTime},{id:'local-daily',anonId:owner,source:'daily-pull',cardName:'The Star',whisper:'Fictional new local record',spreadType:'daily-pull',question:null,territory:'daily',createdAt:fixedTime}]));
    window.dispatchEvent(new Event('hint:local-daily-readings-updated'));
  },{owner,fixedTime});
  await expect(page.getByRole('button',{name:/^Daily/})).toHaveText('Daily2');
  await expect(page.locator('.hr-entry')).toHaveCount(2);
  rows=[...rows,remote('remote-refresh','daily-pull')];
  await page.evaluate(()=>{window.dispatchEvent(new Event('offline'));window.dispatchEvent(new Event('online'));});
  await expect(page.getByRole('button',{name:/^Daily/})).toHaveText('Daily3');
  await expect(page.getByRole('button',{name:/^Daily/})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.hr-entry')).toHaveCount(3);
  await page.getByRole('button',{name:/^Questions/}).click();
  await page.evaluate(({owner,fixedTime})=>{
    localStorage.setItem('hint_local_question_history_v1',JSON.stringify([{id:'question-local',anonId:owner,question:'Fictional refreshed question?',focus:'Self',spreadType:'single',createdAt:fixedTime}]));
    window.dispatchEvent(new Event('hint:local-question-history-updated'));
  },{owner,fixedTime});
  await expect(page.getByRole('button',{name:/^Questions/})).toHaveText('Questions1');
  await expect(page.getByText('Fictional refreshed question?',{exact:true})).toBeVisible();
});

test('loading, error and retry keep the chosen filter and show recovered API records',async({page})=>{
  let release!:()=>void;const gate=new Promise<void>(r=>release=r);let failed=true;
  await page.route('**/api/readings**',async route=>{await gate;await route.fulfill(failed?{status:503,json:{error:'Fictional outage'}}:{json:[remote('retry-record','daily-pull')]});});
  await page.addInitScript(()=>{localStorage.setItem('hint-language','en');localStorage.setItem('hint-theme','bright');});
  await page.goto('/app/readings?hintPreview=embedded');
  await expect(page.locator('.hr-loading')).toBeVisible();
  await page.getByRole('button',{name:/^Daily/}).click();release();
  await expect(page.getByRole('button',{name:'Retry',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:/^Daily/})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.hr-empty')).toBeVisible();
  failed=false;await page.getByRole('button',{name:'Retry',exact:true}).click();
  await expect(page.getByText('Fictional reflection retry-record',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:/^Daily/})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.hr-error')).toHaveCount(0);
});

test('cached records remain filterable through failed refresh and retry',async({page})=>{
  let failed=false;
  await page.route('**/api/readings**',route=>route.fulfill(failed?{status:503,json:{error:'Fictional outage'}}:{json:[remote('retained')]}));
  await open(page);await page.getByRole('button',{name:/^Tarot/}).click();
  failed=true;await page.evaluate(()=>{window.dispatchEvent(new Event('offline'));window.dispatchEvent(new Event('online'));});
  await expect(page.getByRole('button',{name:'Retry',exact:true})).toBeVisible();
  await expect(page.getByText('Fictional reflection retained',{exact:true})).toBeVisible();
  failed=false;await page.getByRole('button',{name:'Retry',exact:true}).click();
  await expect(page.locator('.hr-error')).toHaveCount(0);
  await expect(page.getByRole('button',{name:/^Tarot/})).toHaveAttribute('aria-pressed','true');
});
