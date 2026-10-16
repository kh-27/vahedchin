import { defineConfig } from "@playwright/test";

// e2e against the production build, served like GitHub Pages under /vahedchin/.
// Locally the installed Chrome is used (no browser download); CI installs Playwright's Chromium.
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: {
    baseURL: "http://localhost:4173/vahedchin/",
    locale: "fa-IR",
    ...(process.env.CI ? {} : { channel: "chrome" }),
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1100, height: 900 } } },
    { name: "phone", use: { viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: "npm run build && npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173/vahedchin/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
