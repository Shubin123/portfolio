// Verifies the deployed project sites carry the same mark as their portfolio
// card, and that shubinwang.com serves each of them too. Hits the real
// deployments, so it is opt-in: LIVE=1 npm run test:live
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const sites = require('../scripts/icon-sites.json');

const USER = 'Shubin123';
const DOMAIN = 'shubinwang.com';
const describe = process.env.LIVE ? test.describe : test.describe.skip;

describe('deployed sites', () => {
  for (const [repo, paths] of Object.entries(sites)) {
    test(`${repo} serves the same mark as its portfolio card`, async ({ page, request }) => {
      // A repo moved to another owner keeps its own site URL in icon-sites.json.
      const site = paths.site || `https://${USER}.github.io/${repo}/`;
      const response = await page.goto(site, { waitUntil: 'domcontentloaded' });
      expect(response.status(), site).toBe(200);

      // The favicon and the on-page mark both point at the deployed icon.
      await expect(page.locator(`link[rel="icon"]`)).toHaveAttribute('href', new RegExp(`${paths.deployed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
      const mark = page.locator(`img.project-mark, img.brand-icon, img.project-icon, img[src$="${paths.deployed}"]`).first();
      if (paths.header !== false) {
        await expect(mark).toBeVisible();
        // The React sites mount after load, so the mark decodes late — poll for it.
        await expect.poll(() => mark.evaluate(img => img.naturalWidth), { timeout: 15000 }).toBeGreaterThan(0);
      }

      // Byte-identical to the copy the portfolio grid renders, so one icon set
      // covers the card and the site it links to.
      const deployed = await request.get(new URL(paths.deployed, site).href);
      expect(deployed.ok(), paths.deployed).toBe(true);
      const local = fs.readFileSync(path.join(__dirname, '..', 'assets/icons', `${repo.toLowerCase()}.svg`), 'utf8');
      expect((await deployed.text()).trim()).toBe(local.trim());
    });
  }
});

describe('entry points', () => {
  test('the bare user site redirects to the portfolio', async ({ page }) => {
    await page.goto(`https://${USER.toLowerCase()}.github.io/`);
    await expect(page).toHaveURL(`https://${USER.toLowerCase()}.github.io/portfolio/`);
    await expect(page.locator('#profile-link')).toHaveAttribute('href', `https://github.com/${USER}`);
  });
});

describe(DOMAIN, () => {
  // Read off the live repo list, not a fixture, so a new Pages site is checked
  // as soon as it exists — the same way netlify.toml picks it up.
  test('serves every project Pages site at /<repo>/', async ({ request }) => {
    test.setTimeout(120000);
    const names = [];
    for (let page = 1; ; page++) {
      const response = await request.get(`https://api.github.com/users/${USER}/repos?type=public&per_page=100&page=${page}`,
        { headers: process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {} });
      expect(response.ok(), 'GitHub repo list').toBe(true);
      const batch = await response.json();
      names.push(...batch.filter(repo => repo.has_pages && repo.name.toLowerCase() !== `${USER.toLowerCase()}.github.io`).map(repo => repo.name));
      if (batch.length < 100) break;
    }
    expect(names).toContain('midi');

    const title = html => (html.match(/<title>([^<]*)<\/title>/i) || [])[1];
    await Promise.all(names.map(async name => {
      // No redirects followed, so a proxy that bounces visitors to github.io fails here.
      const [own, proxied] = await Promise.all([`https://${USER}.github.io/${name}/`, `https://${DOMAIN}/${name}/`]
        .map(url => request.get(url, { maxRedirects: 0 })));
      expect.soft(proxied.status(), proxied.url()).toBe(own.status());
      expect.soft(title(await proxied.text()), proxied.url()).toBe(title(await own.text()));
    }));
  });

  test('a bare /<repo> gets the slash its relative paths need', async ({ page }) => {
    for (const name of ['midi', 'tts']) {
      await page.goto(`https://${DOMAIN}/${name}`);
      await expect(page).toHaveURL(`https://${DOMAIN}/${name}/`);
      // ./app-icon.svg only resolves inside the project with the slash.
      const mark = page.locator('img[src$="app-icon.svg"]').first();
      await expect.poll(() => mark.evaluate(img => img.naturalWidth), { timeout: 15000 }).toBeGreaterThan(0);
    }
  });
});
