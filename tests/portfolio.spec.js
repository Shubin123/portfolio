const { test, expect } = require('@playwright/test');
const repos = require('./repos.json');
async function open(page) {
  await page.route(/^https:\/\/api\.github\.com\/users\/Shubin123(?:\/repos\?.*)?$/, route => {
    if (route.request().url().includes('/repos?')) return route.fulfill({ json: repos });
    return route.fulfill({ json: { login: 'Shubin123', public_repos: 999, followers: 4 } });
  });
  await page.goto('./');
  await expect(page.locator('.card:not(.skeleton)')).toHaveCount(27);
}
test('public total is the same snapshot as non-forks and forks, independent of profile API', async ({ page }) => {
  await open(page);
  await expect(page.locator('#profile-stats')).toContainText('32 public repos');
  await expect(page.locator('#profile-stats')).toContainText('27 non-forks');
  await expect(page.locator('#profile-stats')).toContainText('5 forks');
  await expect(page.locator('#repo-count')).toHaveText('Showing 27 of 32 public repositories · 5 forks hidden');
  await page.getByLabel('Include forks (5)').check();
  await expect(page.locator('.card:not(.skeleton)')).toHaveCount(32);
  await expect(page.locator('#repo-count')).toHaveText('Showing 32 of 32 public repositories');
  await page.getByLabel('Search projects', { exact: true }).fill('stonk');
  await expect(page.locator('#repo-count')).toHaveText('Showing 1 of 32 public repositories');
  await page.getByLabel('Search projects', { exact: true }).fill('no-such-project');
  await expect(page.locator('#repo-count')).toHaveText('Showing 0 of 32 public repositories');
  await expect(page.locator('.empty-state')).toBeVisible();
});
test('cached repositories and a late profile response cannot produce mismatched counts', async ({ page }) => {
  await open(page);
  await page.reload();
  await expect(page.locator('#repo-count')).toHaveText('Showing 27 of 32 public repositories · 5 forks hidden');
  await expect(page.locator('#profile-stats')).toContainText('32 public repos');
  await expect(page.locator('#profile-stats')).not.toContainText('999');
});
test('all project marks are local SVGs and Pages links stay on the actual deployment', async ({ page, request }) => {
  await open(page);
  await page.getByLabel('Include forks (5)').check();
  const icons = await page.locator('.project-icon').evaluateAll(images => images.map(img => img.getAttribute('src')));
  expect(new Set(icons).size).toBe(32);
  for (const src of icons) {
    const response = await request.get(new URL(src, page.url()).href);
    expect(response.ok(), src).toBe(true);
    const svg = await response.text();
    expect(svg).toContain('<svg');
    expect(svg).not.toMatch(/<text|<script|<foreignObject/);
  }
  await expect(page.locator('#favicon')).toHaveAttribute('href', 'assets/icons/portfolio.svg');
  const kokoro = page.locator('.card').filter({ has: page.getByRole('link', { name: 'kokorojs', exact: true }) });
  await expect(kokoro.locator('.pages-cta')).toHaveAttribute('href', 'https://Shubin123.github.io/kokorojs/');
});
test('wider viewports add columns and align every row, including zoom-out-sized viewports', async ({ page }) => {
  await open(page);
  let previous = 0;
  for (const width of [1280, 1920, 2560]) {
    await page.setViewportSize({ width, height: 1100 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const layout = await page.locator('#repo-grid').evaluate(grid => {
      const cards = [...grid.children].map(el => el.getBoundingClientRect());
      const row = cards.filter(rect => rect.top === cards[0].top);
      return { columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length, heights: row.map(rect => rect.height), fits: document.documentElement.scrollWidth <= innerWidth };
    });
    expect(layout.columns).toBeGreaterThan(previous);
    expect(new Set(layout.heights).size).toBe(1);
    expect(layout.fits).toBe(true);
    previous = layout.columns;
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('#repo-grid').evaluate(grid => getComputedStyle(grid).gridTemplateColumns.split(' ').length)).toBe(1);
});
test('empty accounts and private records do not produce stale or misleading totals', async ({ page }) => {
  await open(page);
  await page.route('https://api.github.com/users/Shubin123/repos?*', route => route.fulfill({ json: [{ ...repos[0], private: true }] }));
  await page.locator('#refresh-btn').click();
  await expect(page.locator('#profile-stats')).toContainText('0 public repos');
  await expect(page.locator('#repo-count')).toHaveText('Showing 0 of 0 public repositories');
  await expect(page.locator('.empty-state')).toHaveText('No public repositories yet.');
});
