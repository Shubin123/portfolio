const { test, expect } = require('@playwright/test');
const repos = require('./repos.json');
async function open(page) {
  await page.route(/^https:\/\/api\.github\.com\/users\/Shubin123(?:\/(?:repos|gists)\?.*)?$/, route => {
    if (route.request().url().includes('/repos?')) return route.fulfill({ json: repos });
    if (route.request().url().includes('/gists?')) return route.fulfill({ json: [
      { id: 'one', description: 'Useful script', html_url: 'https://gist.github.com/Shubin123/one', updated_at: '2026-09-10T00:00:00Z', public: true, files: { 'script.js': {} } },
      { id: 'two', description: '', html_url: 'https://gist.github.com/Shubin123/two', updated_at: '2026-09-09T00:00:00Z', public: true, files: { 'notes.md': {}, 'data.json': {} } },
    ] });
    return route.fulfill({ json: { login: 'Shubin123', public_repos: 999, followers: 4 } });
  });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto('./');
      break;
    } catch (err) {
      if (attempt < 2 && String(err).includes('ERR_CONNECTION_RESET')) {
        await page.waitForTimeout(100);
        continue;
      }
      throw err;
    }
  }
  await expect(page.locator('.card:not(.skeleton)')).toHaveCount(27, { timeout: 10000 });
}
test('latest public gists are available in the visible sidebar widget', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator('.gists-widget')).toBeVisible();
  await expect(page.locator('#gists-status')).toHaveText('2 public gists');
  await expect(page.locator('.gist-item')).toHaveCount(2);
  await expect(page.getByRole('link', { name: 'Useful script', exact: true })).toHaveAttribute('href', 'https://gist.github.com/Shubin123/one');
  await expect(page.locator('.gist-item').nth(1)).toContainText('notes.md');
  await expect(page.locator('.gists-widget')).toHaveCSS('position', 'sticky');
  await page.setViewportSize({ width: 600, height: 900 });
  await expect(page.locator('.gists-widget')).toHaveCSS('position', 'static');
});
test('gist count reflects true total around 600 from profile, shows latest gists with filtering across all 100, and expands UI panes via pulldown', async ({ page }) => {
  const mockGists = Array.from({ length: 100 }, (_, i) => ({
    id: `gist-${i + 1}`,
    description: i === 0 ? 'Target Special Research' : `Gist description ${i + 1}`,
    html_url: `https://gist.github.com/Shubin123/gist-${i + 1}`,
    updated_at: new Date(Date.now() - i * 60000).toISOString(),
    public: true,
    files: { [`file_${i + 1}.js`]: {} },
  }));

  await page.route(/^https:\/\/api\.github\.com\/users\/Shubin123(?:\/(?:repos|gists)\?.*)?$/, route => {
    if (route.request().url().includes('/repos?')) return route.fulfill({ json: repos });
    if (route.request().url().includes('/gists?')) return route.fulfill({ json: mockGists });
    return route.fulfill({ json: { login: 'Shubin123', public_repos: 32, public_gists: 607, followers: 4 } });
  });

  await page.goto('./');
  await page.setViewportSize({ width: 1280, height: 900 });

  // Verify count is accurate (specifically 607 from profile) and not stuck at 100
  await expect(page.locator('#gists-status')).toHaveText('607 public gists');
  await expect(page.locator('#gists-count-badge')).toHaveText('607');

  // Verify default view does not show full 100 list (shows latest 5)
  await expect(page.locator('.gist-item')).toHaveCount(5);
  await expect(page.locator('#gists-more-btn')).toBeVisible();

  // Test "Show more" expands list
  await page.locator('#gists-more-btn').click();
  await expect(page.locator('.gist-item')).toHaveCount(10);

  // Verify interactive filtering searches across all 100 loaded gists
  await page.locator('#gists-filter').fill('Target Special');
  await expect(page.locator('.gist-item')).toHaveCount(1);
  await expect(page.locator('#gists-status')).toHaveText('Showing 1 of 607 public gists');
  await expect(page.locator('.gist-title')).toHaveText('Target Special Research');

  // Verify filter by filename deeper in the 100 list
  await page.locator('#gists-filter').fill('file_42.js');
  await expect(page.locator('.gist-item')).toHaveCount(1);
  await expect(page.locator('.gist-title')).toHaveText('Gist description 42');

  // Verify filter clear button restores default count of 5
  await page.locator('#gists-filter-clear').click();
  await expect(page.locator('.gist-item')).toHaveCount(5);
  await expect(page.locator('#gists-status')).toHaveText('607 public gists');

  // Verify interactive pulldown toggle & UI panes expansion
  const projectsPanel = page.locator('.projects-panel');
  const widthBeforeCollapse = await projectsPanel.evaluate(el => el.getBoundingClientRect().width);

  // Click pulldown toggle button to collapse widget
  await page.locator('#gists-toggle').click();
  await expect(page.locator('#gists-toggle')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#gists-widget')).toHaveClass(/is-collapsed/);
  await expect(page.locator('#gists-body')).toBeHidden();

  // Assert that the rest of the UI panes (projects-panel) expanded
  const widthAfterCollapse = await projectsPanel.evaluate(el => el.getBoundingClientRect().width);
  const layoutWidth = await page.locator('.content-layout').evaluate(el => el.getBoundingClientRect().width);
  expect(widthAfterCollapse).toBeGreaterThan(widthBeforeCollapse);
  expect(widthAfterCollapse).toBeCloseTo(layoutWidth, 0);

  // Click pulldown toggle button again to expand (pull down) widget
  await page.locator('#gists-toggle').click();
  await expect(page.locator('#gists-toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#gists-body')).toBeVisible();
  await expect(page.locator('.gist-item')).toHaveCount(5);
});
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
test('counts on a card read as singular or plural, and never contradict the badges', async ({ page }) => {
  await open(page);
  const card = name => page.locator('.card').filter({ has: page.getByRole('link', { name, exact: true }) });
  await page.getByLabel('Include forks (5)').check(); // the only 1-star fixture is a fork
  await expect(card('amazon-scraper').locator('.card-meta')).toContainText('1 star');
  await expect(card('amazon-scraper').locator('.card-meta')).not.toContainText('1 stars');
  await expect(card('amazon-scraper').locator('.card-meta')).toContainText('2 forks of this repo');
  await expect(card('aimjs').locator('.card-meta')).toContainText('0 stars');
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
test('gist count updates from GitHub instead of staying on a stale cached profile', async ({ page }) => {
  let liveCount = 612;
  await page.route(/^https:\/\/api\.github\.com\/users\/Shubin123(?:\/(?:repos|gists)\?.*)?$/, route => {
    if (route.request().url().includes('/repos?')) return route.fulfill({ json: repos });
    if (route.request().url().includes('/gists?')) return route.fulfill({ json: [
      { id: 'one', description: 'Useful script', html_url: 'https://gist.github.com/Shubin123/one', updated_at: '2026-09-10T00:00:00Z', public: true, files: { 'script.js': {} } },
    ] });
    return route.fulfill({ json: { login: 'Shubin123', public_repos: 32, public_gists: liveCount, followers: 4 } });
  });
  // Seed a profile cached an hour ago with an older count.
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('gh-portfolio-profile:Shubin123', JSON.stringify({
      timestamp: Date.now() - 60 * 60 * 1000,
      data: { login: 'Shubin123', public_repos: 32, public_gists: 607, followers: 4 },
    }));
  });

  await page.goto('./');
  await expect(page.locator('#gists-count-badge')).toHaveText('612');
  await expect(page.locator('#gists-status')).toHaveText('612 public gists');

  // A new gist is published; Refresh picks it up even though the cache is fresh.
  liveCount = 613;
  await page.locator('#refresh-btn').click();
  await expect(page.locator('#gists-count-badge')).toHaveText('613');
  await expect(page.locator('#gists-status')).toHaveText('613 public gists');
});

test('tag bar displays available project tag clusters with counts and filters projects interactively', async ({ page }) => {
  await open(page);
  const tagBar = page.locator('#tag-bar');
  await expect(tagBar).toBeVisible();

  const allPill = tagBar.locator('.tag-pill[data-tag=""]');
  await expect(allPill).toBeVisible();
  await expect(allPill).toHaveClass(/is-active/);
  await expect(allPill.locator('.tag-count')).toHaveText('27');

  const aiPill = tagBar.locator('.tag-pill[data-tag="ai"]');
  await expect(aiPill).toBeVisible();
  const countText = await aiPill.locator('.tag-count').textContent();
  const aiCount = Number(countText);
  expect(aiCount).toBeGreaterThan(0);

  // Click #ai tag to cluster/filter
  await aiPill.click();
  await expect(aiPill).toHaveClass(/is-active/);
  await expect(allPill).not.toHaveClass(/is-active/);
  await expect(page.locator('#repo-count')).toContainText('Tagged "ai"');
  await expect(page.locator('.card:not(.skeleton)')).toHaveCount(aiCount);

  // Clicking active tag pill again toggles it off back to All
  await aiPill.click();
  await expect(allPill).toHaveClass(/is-active/);
  await expect(page.locator('.card:not(.skeleton)')).toHaveCount(27);
  await expect(page.locator('#repo-count')).toHaveText('Showing 27 of 32 public repositories · 5 forks hidden');
});

test('clicking a topic chip on a project card clusters projects by that tag', async ({ page }) => {
  await open(page);
  const kokoroCard = page.locator('.card').filter({ has: page.getByRole('link', { name: 'kokorojs', exact: true }) });
  const aiChip = kokoroCard.locator('.topic-chip[data-tag="ai"]');
  await expect(aiChip).toBeVisible();
  await aiChip.click();

  const aiPill = page.locator('#tag-bar .tag-pill[data-tag="ai"]');
  await expect(aiPill).toHaveClass(/is-active/);
  await expect(page.locator('#repo-count')).toContainText('Tagged "ai"');

  const visibleCards = page.locator('.card:not(.skeleton)');
  const count = await visibleCards.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    await expect(visibleCards.nth(i).locator('.topic-chip.is-active')).toBeVisible();
  }
});

test('cluster view mode organizes projects into cluster sections with headers and count badges', async ({ page }) => {
  await open(page);
  const clusterSwitch = page.getByLabel('Cluster by tag');
  await clusterSwitch.check();

  await expect(page.locator('#repo-grid')).toHaveClass(/is-clustered/);
  const clusterGroups = page.locator('.cluster-group');
  expect(await clusterGroups.count()).toBeGreaterThan(1);

  const firstHeader = clusterGroups.first().locator('.cluster-header');
  await expect(firstHeader).toBeVisible();
  await expect(firstHeader.locator('.cluster-title')).toBeVisible();
  await expect(firstHeader.locator('.cluster-badge')).toBeVisible();

  // Focus a specific cluster
  const focusBtn = firstHeader.locator('.cluster-filter-btn');
  if (await focusBtn.isVisible()) {
    await focusBtn.click();
    await expect(page.locator('#repo-count')).toContainText('Tagged');
  }

  // Toggle off cluster view returns to normal grid
  await clusterSwitch.uncheck();
  await expect(page.locator('#repo-grid')).not.toHaveClass(/is-clustered/);
});

test('tag filtering and text search combine seamlessly with clear filters action', async ({ page }) => {
  await open(page);
  await page.locator('#tag-bar .tag-pill[data-tag="ai"]').click();
  await page.getByLabel('Search projects', { exact: true }).fill('kokoro');
  await expect(page.locator('.card:not(.skeleton)')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'kokorojs', exact: true })).toBeVisible();

  await page.getByLabel('Search projects', { exact: true }).fill('no-such-term-ai-xyz');
  await expect(page.locator('.card:not(.skeleton)')).toHaveCount(0);
  await expect(page.locator('.empty-state')).toBeVisible();

  await page.locator('.empty-state button').click();
  await expect(page.locator('.card:not(.skeleton)')).toHaveCount(27);
  await expect(page.locator('#tag-bar .tag-pill[data-tag=""]')).toHaveClass(/is-active/);
});
test('a fork served from another account\'s Pages site shows that account, not the default', async ({ page, request, baseURL }) => {
  // Serve the local files as if they were deployed at https://forker.github.io/portfolio/.
  await page.route('https://forker.github.io/portfolio/**', async route => {
    const file = new URL(route.request().url()).pathname.replace(/^\/portfolio\//, '') || 'index.html';
    const response = await request.get(new URL(file, baseURL + '/').href);
    return route.fulfill({ response });
  });
  const own = repos.filter(repo => !repo.fork).slice(0, 3).map(repo => ({ ...repo, owner: { login: 'forker' } }));
  const asked = [];
  await page.route('https://api.github.com/**', route => {
    const url = route.request().url();
    asked.push(url);
    if (url.includes('/repos?')) return route.fulfill({ json: own });
    if (url.includes('/gists?')) return route.fulfill({ json: [] });
    return route.fulfill({ json: { login: 'forker', html_url: 'https://github.com/forker', public_repos: 3, followers: 0 } });
  });
  await page.goto('https://forker.github.io/portfolio/');
  await expect(page.locator('.card:not(.skeleton)')).toHaveCount(3, { timeout: 10000 });
  await expect(page).toHaveTitle('forker — Projects');
  await expect(page.locator('#display-name')).toHaveText('forker');
  await expect(page.locator('#profile-link')).toHaveAttribute('href', 'https://github.com/forker');
  await expect(page.locator('#gists-link')).toHaveAttribute('href', 'https://gist.github.com/forker');
  expect(asked.length).toBeGreaterThan(0);
  expect(asked.every(url => url.includes('/users/forker'))).toBe(true);
  const { name, has_pages } = own[0];
  const card = page.locator('.card').filter({ has: page.getByRole('link', { name, exact: true }) });
  if (has_pages) await expect(card.locator('.pages-cta')).toHaveAttribute('href', `https://forker.github.io/${name}/`);
});

test('translate menu switches the whole page to the DeepL Chinese dictionary and back, and remembers the choice', async ({ page }) => {
  const zh = require('../assets/i18n/zh.json');
  const fill = (template, vars) => template.replace(/\{(\w+)\}/g, (_, name) => String(vars[name]));
  const dictionaryRequests = [];
  page.on('request', request => { if (request.url().includes('/assets/i18n/')) dictionaryRequests.push(request.url()); });
  await open(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  expect(dictionaryRequests).toHaveLength(0); // English visitors never download a dictionary

  const toggle = page.locator('#lang-toggle');
  await expect(toggle).toHaveAccessibleName('Translate this page');
  await expect(page.locator('#lang-current')).toHaveText('English');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#lang-options')).toBeVisible();
  await expect(page.getByRole('menuitemradio', { name: 'English' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('menuitemradio', { name: '中文（简体）' }).click();

  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.locator('#lang-options')).toBeHidden();
  await expect(page.locator('#lang-current')).toHaveText('中文');
  await expect(toggle).toHaveAccessibleName(zh.strings['Translate this page']);
  // Static markup, attributes, JS-rendered UI, GitHub content, and tags are all translated.
  await expect(page).toHaveTitle(fill(zh.strings['{user} — Projects'], { user: 'Shubin123' }));
  await expect(page.locator('#projects-heading')).toHaveText(zh.strings['A live feed of my public repositories']);
  await expect(page.locator('#search')).toHaveAttribute('placeholder', zh.strings['Search projects by name, description, or topic…']);
  await expect(page.locator('#sort option[value="stars"]')).toHaveText(zh.strings['Most stars']);
  await expect(page.locator('#refresh-label')).toHaveText(zh.strings['Refresh']);
  const pattern = template => new RegExp(`^${template.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{\w+\}/g, '.+')}$`);
  await expect(page.locator('#status')).toHaveText(pattern(zh.strings['Last updated {time}']));
  await expect(page.locator('#repo-count')).toHaveText(`${fill(zh.plurals['Showing {shown} of {count} public repositories'].other, { shown: 27, count: 32 })} · ${fill(zh.plurals['{count} forks hidden'].other, { count: 5 })}`);
  await expect(page.locator('#profile-stats')).toContainText(fill(zh.plurals['{count} public repos'].other, { count: 32 }));
  await expect(page.locator('#fork-label')).toHaveText(fill(zh.strings['Include forks ({count})'], { count: 5 }));
  await expect(page.locator('#gists-heading')).toHaveText(zh.strings['Latest gists']);
  await expect(page.locator('#gists-status')).toHaveText(fill(zh.plurals['{count} public gists'].other, { count: 2 }));
  const card = name => page.locator('.card').filter({ has: page.getByRole('link', { name, exact: true }) });
  const aimjs = card('aimjs');
  await expect(aimjs.locator('.card-desc')).toHaveText(zh.strings['Object Detection and Cursor Control using Javascript.']);
  await expect(aimjs.locator('.pages-cta')).toHaveText(zh.strings['View live site']);
  await expect(aimjs.locator('.topic-chip[data-tag="browser"]')).toHaveText(`#${zh.tags.browser}`);
  await expect(card('vul').locator('.card-desc')).toHaveText(zh.strings['No description provided.']);
  // Gist text missing from the dictionary falls back to English instead of disappearing.
  await expect(page.getByRole('link', { name: 'Useful script', exact: true })).toBeVisible();
  // Searching and tag filters work with the translated text.
  await page.locator('#search').fill(zh.tags.browser);
  await expect(page.locator('#repo-count')).toContainText(fill(zh.plurals['Showing {shown} of {count} public repositories'].other, { shown: 27, count: 32 }));
  await page.locator('#search').fill('');
  await page.locator('.tag-pill[data-tag="browser"]').click();
  await expect(page.locator('#repo-count')).toContainText(`“${zh.tags.browser}”`);

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.locator('#refresh-label')).toHaveText(zh.strings['Refresh']);

  await toggle.click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#lang-options')).toBeHidden();
  await expect(toggle).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitemradio', { name: '中文（简体）' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#lang-current')).toHaveText('English');
  await expect(page).toHaveTitle('Shubin123 — Projects');
  await expect(page.locator('#refresh-label')).toHaveText('Refresh');
  await expect(page.locator('#repo-count')).toHaveText('Showing 27 of 32 public repositories · 5 forks hidden');
  await expect(aimjs.locator('.card-desc')).toHaveText('Object Detection and Cursor Control using Javascript.');
  await expect(page.locator('#search')).toHaveAttribute('placeholder', 'Search projects by name, description, or topic…');
});

test('each language downloads only when picked, uses its own plural forms, and stays cached until its dictionary changes', async ({ page }) => {
  const fr = require('../assets/i18n/fr.json');
  const ru = require('../assets/i18n/ru.json');
  const fill = (template, vars) => template.replace(/\{(\w+)\}/g, (_, name) => String(vars[name]));
  const downloads = [];
  page.on('request', request => { if (request.url().includes('/assets/i18n/')) downloads.push(new URL(request.url()).pathname.split('/').pop()); });
  const choose = async name => {
    await page.locator('#lang-toggle').click();
    await page.getByRole('menuitemradio', { name }).click();
  };
  const card = name => page.locator('.card').filter({ has: page.getByRole('link', { name, exact: true }) });
  await open(page);

  await page.locator('#lang-toggle').click();
  await expect(page.getByRole('menuitemradio')).toHaveCount(9);
  await expect(page.getByRole('menuitemradio', { name: 'Français' })).toHaveAttribute('lang', 'fr');
  await page.keyboard.press('Escape');
  expect(downloads).toEqual([]);

  await choose('Français');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.locator('#lang-current')).toHaveText('Français');
  await expect(page.locator('#projects-heading')).toHaveText(fr.strings['A live feed of my public repositories']);
  await expect(page.locator('#profile-stats')).toContainText(fill(fr.plurals['{count} public repos'].other, { count: 32 }));
  await expect(card('aimjs').locator('.card-meta')).toContainText(fill(fr.plurals['{count} stars'].one, { count: 0 })); // French 0 is singular
  expect(downloads).toEqual(['fr.json']);

  // Russian has three forms for whole numbers: 2 and 32 take one, 0 and 5 another.
  await choose('Русский');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.locator('#gists-status')).toHaveText(fill(ru.plurals['{count} public gists'].few, { count: 2 }));
  await expect(page.locator('#repo-count')).toHaveText(`${fill(ru.plurals['Showing {shown} of {count} public repositories'].few, { shown: 27, count: 32 })} · ${fill(ru.plurals['{count} forks hidden'].many, { count: 5 })}`);
  await expect(card('aimjs').locator('.card-meta')).toContainText(fill(ru.plurals['{count} stars'].many, { count: 0 }));
  expect(downloads).toEqual(['fr.json', 'ru.json']);

  // Going back is served from memory, and a reload from the stored copy, without the network.
  await choose('Français');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await page.reload();
  await expect(page.locator('#projects-heading')).toHaveText(fr.strings['A live feed of my public repositories']);
  expect(downloads).toEqual(['fr.json', 'ru.json']);

  // A stored copy of an older dictionary is downloaded again.
  await page.evaluate(() => {
    const key = 'gh-portfolio-i18n:fr';
    localStorage.setItem(key, JSON.stringify({ ...JSON.parse(localStorage.getItem(key)), version: 'old' }));
  });
  await page.reload();
  await expect(page.locator('#projects-heading')).toHaveText(fr.strings['A live feed of my public repositories']);
  expect(downloads).toEqual(['fr.json', 'ru.json', 'fr.json']);
});

test('every UI string has a translation in every language', async () => {
  const { execFileSync } = require('child_process');
  execFileSync('python3', ['scripts/translate.py', '--check'], { cwd: require('path').join(__dirname, '..') });
});
