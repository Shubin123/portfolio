const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  fullyParallel: true,
  workers: 2,
  testDir: './tests',
  use: { baseURL: process.env.SITE_URL || 'http://127.0.0.1:4174', trace: 'retain-on-failure' },
  webServer: process.env.SITE_URL ? undefined : {
    command: 'python3 -m http.server 4174 --bind 127.0.0.1 2>/dev/null',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: !process.env.CI,
  },
});
