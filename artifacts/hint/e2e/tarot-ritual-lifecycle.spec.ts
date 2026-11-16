import { test, expect, type Page } from './fixtures';

async function enterRitual(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('hint_onboarding_complete_v3', '1');
    localStorage.setItem('hint_local_auth_v1', JSON.stringify({
      identifier: 'ritual@hint.local', provider: 'email', email: 'ritual@hint.local', name: 'Fictional Reader',
      verifiedAt: '2026-09-10T00:00:00Z', createdAt: '2026-09-10T00:00:00Z', lastSignedInAt: '2026-09-10T00:00:00Z',
    }));
    sessionStorage.setItem('hint_active_tarot_reading_v1', JSON.stringify({
      version: 1, savedAt: Date.now(), phase: 'prepare', question: 'What would help me make space today?',
      spreadId: 'three', focusLabel: 'A quiet reflection', selectedCards: [], revealedIds: [],
      design: { id: 'sea', label: 'Deep Sea', mood: 'Quiet', deckStyleId: 'rose', backStyle: 'rose',
        cardBackId: '01_Final_Eight_Set/02_Moon_Tide_Lavender_Gold.png', cardArtId: 'hint-classic',
        backgroundId: 'sea', background: '#fff', glow: '#fff' },
    }));
  });
  await page.goto('/app/tarot?hintPreview=embedded');
  await expect(page.getByRole('button', { name: 'Auto Wash', exact: true })).toBeVisible();
}

test('backgrounding during the riffle cancels its visuals and returns to one fresh ritual', async ({ page }, info) => {
  await enterRitual(page);
  await page.getByRole('button', { name: 'Auto Wash', exact: true }).click();
  await expect(page.locator('[data-shuffle-card]')).toHaveCount(78);
  await page.waitForTimeout(1100);
  await page.screenshot({ path: info.outputPath('riffle-before-background.png') });
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  // State guards alone are insufficient: the abandoned 78-card animation must
  // stop too, including in a WebView that keeps delivering animation frames.
  await expect(page.locator('[data-shuffle-card]')).toHaveCount(0);
  await page.waitForTimeout(4500);
  await expect(page.getByLabel('Rotating tarot deck wheel')).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const auto = page.getByRole('button', { name: 'Auto Wash', exact: true });
  await expect(auto).toBeVisible();
  // Two deliveries in one turn must start only one wash/cut sequence.
  await auto.evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  await expect(page.getByRole('heading', { name: 'Pick Cards', exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel('Rotating tarot deck wheel')).toHaveCount(1);
  await expect(page.getByLabel('Rotating tarot deck wheel')).toHaveAttribute('data-deck-size', '78');
  const session = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(key => key.startsWith('hint_active_tarot_reading_v2:'))!;
    return JSON.parse(localStorage.getItem(key)!);
  });
  expect(session.phase).toBe('pick');
  expect(session.selectedCards).toHaveLength(0);
  expect(session.revealedIds).toHaveLength(0);
  expect(new Set(session.deck.map((card: { visualId: string }) => card.visualId)).size).toBe(78);
  expect(new Set(session.deck.map((card: { cardId: string }) => card.cardId)).size).toBe(78);
  await page.screenshot({ path: info.outputPath('selection-after-recovery.png') });
});

test('Back during the riffle cancels its visuals without advancing the abandoned ritual', async ({ page }) => {
  await enterRitual(page);
  await page.getByRole('button', { name: 'Auto Wash', exact: true }).click();
  await expect(page.locator('[data-shuffle-card]')).toHaveCount(78);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.locator('[data-shuffle-card]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Auto Wash', exact: true })).toBeVisible();
  await page.waitForTimeout(4500);
  await expect(page.getByLabel('Rotating tarot deck wheel')).toHaveCount(0);
});
