// Verifies the deployed project sites carry the same mark as their portfolio
// card. Hits the real Pages deployments, so it is opt-in: LIVE=1 npm run test:live
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const sites = require('../scripts/icon-sites.json');

const USER = 'Shubin123';
const describe = process.env.LIVE ? test.describe : test.describe.skip;

describe('deployed sites', () => {
  for (const [repo, paths] of Object.entries(sites)) {
    test(`${repo} serves the same mark as its portfolio card`, async ({ page, request }) => {
      const site = `https://${USER}.github.io/${repo}/`;
      const response = await page.goto(site, { waitUntil: 'domcontentloaded' });
      expect(response.status(), site).toBe(200);

      // The favicon and the on-page mark both point at the deployed icon.
      await expect(page.locator(`link[rel="icon"]`)).toHaveAttribute('href', new RegExp(`${paths.deployed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
      await expect(page.locator('img.project-mark, img.brand-icon, img.project-icon').first()).toBeVisible();
      expect(await page.locator('img.project-mark, img.brand-icon, img.project-icon').first().evaluate(img => img.naturalWidth)).toBeGreaterThan(0);

      // Byte-identical to the copy the portfolio grid renders, so one icon set
      // covers the card and the site it links to.
      const deployed = await request.get(new URL(paths.deployed, site).href);
      expect(deployed.ok(), paths.deployed).toBe(true);
      const local = fs.readFileSync(path.join(__dirname, '..', 'assets/icons', `${repo.toLowerCase()}.svg`), 'utf8');
      expect((await deployed.text()).trim()).toBe(local.trim());
    });
  }
});
