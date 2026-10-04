import { expect, test } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("hint_onboarding_complete_v3", "1");
    localStorage.setItem("hint_launch_seen_v2", "1");
    localStorage.setItem("hint-language", "en");
    localStorage.setItem("hint.preferences.v1", JSON.stringify({ reduceMotion: false, soundAndHaptics: false }));
  });
  await page.route("**/api/tarot/spread-recommendation", route => route.fulfill({ json: {
    spreadType: "three", reason: "A fictional reflection with three clear positions.",
    focusLabel: "Fictional reflection", confidence: "high", source: "api",
  } }));
  await page.goto("/app/tarot?hintPreview=embedded");
  await page.getByPlaceholder("Type your question...").fill("What can I reflect on today?");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator('[data-spread-preview="three"]')).toBeVisible();
  await expect(page.getByTestId("spread-preview-stage")).toHaveAttribute("data-spread-motion", "idle");
});

test("spread arrows have generous lateral targets beside the cards", async ({ page }, info) => {
  const stage = page.getByTestId("spread-preview-stage");
  const box = (await stage.boundingBox())!;
  const arrows = [page.getByRole("button", { name: "Previous spread" }), page.getByRole("button", { name: "Next spread" })];
  const diagram = (await page.locator(".tarot-spread-diagram").boundingBox())!;
  for (const [index, arrow] of arrows.entries()) {
    const button = (await arrow.boundingBox())!;
    expect(button.width).toBeGreaterThanOrEqual(48);
    expect(button.height).toBeGreaterThanOrEqual(48);
    expect(Math.abs(button.y + button.height / 2 - (box.y + box.height / 2))).toBeLessThan(2);
    if (index === 0) expect(button.x + button.width).toBeLessThanOrEqual(diagram.x + 1);
    else expect(button.x).toBeGreaterThanOrEqual(diagram.x + diagram.width - 1);
  }
  await page.screenshot({ path: info.outputPath("spread-lateral-navigation.png") });
  await arrows[1]!.tap();
  await expect(page.locator('[data-spread-preview="relationship"]')).toBeVisible();
  await arrows[0]!.tap();
  await expect(page.locator('[data-spread-preview="three"]')).toBeVisible();
});

test("a vertical gesture cannot turn into an accidental spread change", async ({ page }) => {
  const stage = page.getByTestId("spread-preview-stage");
  await stage.scrollIntoViewIfNeeded();
  const box = (await stage.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 3, y + 18);
  await page.mouse.move(x - 100, y + 24, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('[data-spread-preview="three"]')).toBeVisible();
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 95, y + 3, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('[data-spread-preview="relationship"]')).toBeVisible();
  await stage.focus();
  await stage.press("ArrowLeft");
  await expect(page.locator('[data-spread-preview="three"]')).toBeVisible();
});

test("spread-to-spread motion carries the diagrams through one continuous track", async ({ page }, info) => {
  const stage = page.getByTestId("spread-preview-stage");
  await stage.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    const samples: Array<{ motion: string | null; current: string | null; retained: string[]; height: number; x: number; visibleCards: number }> = [];
    (window as any).spreadTransitionSamples = samples;
    const start = performance.now();
    function sample() {
      const stage = document.querySelector('[data-testid="spread-preview-stage"]')!;
      const clip = stage.querySelector(".tarot-spread-diagram")!.getBoundingClientRect();
      const track = stage.querySelector(".tarot-spread-track")!;
      const visibleCards = [...stage.querySelectorAll(".tarot-spread-card-art")].filter(card => {
        const r = card.getBoundingClientRect();
        return r.right > clip.left + 2 && r.left < clip.right - 2 && r.bottom > clip.top && r.top < clip.bottom;
      }).length;
      samples.push({ motion: stage.getAttribute("data-spread-motion"), current: stage.querySelector("[data-spread-preview]")?.getAttribute("data-spread-preview") ?? null,
        retained: [...stage.querySelectorAll("[data-spread-retained]")].map(e => e.getAttribute("data-spread-retained")!),
        height: stage.getBoundingClientRect().height, x: track.getBoundingClientRect().x, visibleCards });
      if (performance.now() - start < 520) requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  await page.getByRole("button", { name: "Next spread" }).tap();
  await expect(stage).toHaveAttribute("data-spread-motion", "idle");
  await page.waitForTimeout(550);
  const samples = await page.evaluate(() => (window as any).spreadTransitionSamples as Array<{ motion: string; current: string; retained: string[]; height: number; x: number; visibleCards: number }>);
  const moving = samples.filter(s => s.motion === "moving");
  expect(moving.length).toBeGreaterThan(2);
  expect(moving.every(s => s.current === "relationship" && s.retained.includes("three"))).toBe(true);
  expect(new Set(samples.map(s => s.height)).size).toBe(1);
  expect(samples.every(s => s.visibleCards > 0)).toBe(true);
  expect(moving[0]!.x - moving.at(-1)!.x).toBeGreaterThan(60);
  for (let i = 1; i < moving.length; i++) expect(moving[i]!.x).toBeLessThanOrEqual(moving[i - 1]!.x + 1);
  await info.attach("spread-motion-frames", { body: JSON.stringify(samples), contentType: "application/json" });
  await page.screenshot({ path: info.outputPath("spread-after-horizontal-transition.png") });

  // Dispatch several real button handlers without waiting for previous motion.
  await page.evaluate(() => {
    const next = document.querySelector<HTMLButtonElement>('[aria-label="Next spread"]')!;
    next.click(); next.click(); next.click();
    document.querySelector<HTMLButtonElement>('[aria-label="Previous spread"]')!.click();
  });
  await expect(stage).toHaveAttribute("data-spread-motion", "idle");
  await expect(page.locator('[data-spread-preview="peachBlossom"]')).toBeVisible();
  await expect(page.locator("[data-spread-preview]")).toHaveCount(1);
  await page.reload();
  await expect(page.locator('[data-spread-preview="peachBlossom"]')).toBeVisible();
});

test("reduced-motion spread changes settle without a sliding track", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Next spread" }).tap();
  await expect(page.getByTestId("spread-preview-stage")).toHaveAttribute("data-spread-motion", "idle");
  await expect(page.locator('[data-spread-preview="relationship"]')).toBeVisible();
  const clip = (await page.locator(".tarot-spread-diagram").boundingBox())!;
  const diagram = (await page.locator('[data-spread-preview="relationship"]').boundingBox())!;
  expect(Math.abs(clip.x - diagram.x)).toBeLessThan(1);
});

test("all nine spread templates keep cards and labels inside their preview", async ({page},info)=>{
  await page.getByRole("button",{name:"Previous spread"}).click();
  const stage=page.getByTestId("spread-preview-stage");
  for(let index=0;index<9;index++){
    await expect(stage).toHaveAttribute("data-spread-motion","idle");
    await stage.evaluate(el=>el.scrollIntoView({block:"center",behavior:"instant"}));
    const report=await stage.evaluate(el=>{
      const clip=el.querySelector(".tarot-spread-diagram")!.getBoundingClientRect();
      const current=el.querySelector("[data-spread-preview]")!;
      return {id:current.getAttribute("data-spread-preview"),outside:[...current.querySelectorAll(".tarot-spread-card-art, .tarot-spread-position-label")].map(node=>{const r=node.getBoundingClientRect();return {outside:r.x<clip.x-1||r.right>clip.right+1||r.y<clip.y-1||r.bottom>clip.bottom+1,text:node.textContent};}).filter(r=>r.outside)};
    });
    await page.screenshot({path:info.outputPath(`spread-${report.id}.png`)});
    expect(report.outside,`${report.id} preview is not cut off`).toEqual([]);
    if(index<8)await page.getByRole("button",{name:"Next spread"}).click();
  }
});

test("spread labels remain readable at 200 percent text size", async ({page},info)=>{
  await page.getByRole("button",{name:"Previous spread"}).click();
  const stage=page.getByTestId("spread-preview-stage");
  for(let index=0;index<9;index++){
    await expect(stage).toHaveAttribute("data-spread-motion","idle");
    await page.locator(".tarot-spread-recommendation").evaluate(root=>{
      const sizes=[...root.querySelectorAll<HTMLElement>("h1,h2,h3,p,button,span,li")]
        .filter(el=>!el.dataset.textScaled&&!el.closest("svg"))
        .map(el=>({el,size:parseFloat(getComputedStyle(el).fontSize)}));
      sizes.forEach(({el,size})=>{el.style.fontSize=`${size*2}px`;el.dataset.textScaled="true";});
    });
    await stage.evaluate(el=>el.scrollIntoView({block:"center",behavior:"instant"}));
    const report=await stage.evaluate(el=>{
      const clip=el.querySelector(".tarot-spread-diagram")!.getBoundingClientRect();
      const current=el.querySelector("[data-spread-preview]")!;
      const labels=[...current.querySelectorAll(".tarot-spread-position-label,.tarot-spread-inline-label")].map(node=>{
        const r=node.getBoundingClientRect();const range=document.createRange();range.selectNodeContents(node);const text=range.getBoundingClientRect();
        return {label:node.textContent,clipped:text.x<clip.x-1||text.right>clip.right+1||text.y<clip.y-1||text.bottom>clip.bottom+1,
          lineOverlap:text.height>r.height+1};
      });
      return {id:current.getAttribute("data-spread-preview"),labels};
    });
    await page.screenshot({path:info.outputPath(`spread-200-${report.id}.png`)});
    expect(report.labels.filter(row=>row.clipped||row.lineOverlap),report.id!).toEqual([]);
    const legend=page.locator(".tarot-spread-position-legend");
    await expect(legend.locator("li")).not.toHaveCount(0);
    const clippedLegend=await legend.locator("li").evaluateAll(nodes=>nodes.filter(node=>{
      const bounds=node.getBoundingClientRect();const range=document.createRange();range.selectNodeContents(node);const text=range.getBoundingClientRect();
      return text.x<bounds.x-1||text.right>bounds.right+1||text.y<bounds.y-1||text.bottom>bounds.bottom+1;
    }).map(node=>node.textContent));
    expect(clippedLegend).toEqual([]);
    if(index<8)await page.getByRole("button",{name:"Next spread"}).click();
  }
});
