import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { addFirstCourse, arrange, open, tab } from "./helpers";

/** Waits until the service worker is active and the term data is in its cache. */
async function waitForOfflineReady(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const keys = await caches.keys();
        const data = await caches.open("vahedchin-data");
        const index = await data.match(new URL("data/index.json", location.href).href);
        return keys.some((k) => k.startsWith("vahedchin-shell-")) && index !== undefined;
      }),
    )
    .toBe(true);
}

test("NFR-14: installable: manifest, icons and an active service worker", async ({ page, request }) => {
  await open(page);
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBe("/vahedchin/manifest.webmanifest");
  const manifest = await (await request.get(href!)).json();
  expect(manifest).toMatchObject({ short_name: "واحدچین", display: "standalone", lang: "fa", dir: "rtl", start_url: "./" });
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  for (const icon of manifest.icons) {
    const res = await request.get(new URL(icon.src, new URL(href!, page.url())).href);
    expect(res.status(), icon.src).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");
  }
  await waitForOfflineReady(page);
  await page.reload();
  expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
});

test("FR-53: after the first visit the app, the data and planning work offline", async ({ page, context }) => {
  await open(page);
  await waitForOfflineReady(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("داده گلستان:")).toBeVisible();
  await expect(page.getByText(/آفلاین هستید/)).toBeVisible();
  await addFirstCourse(page);
  await tab(page, /تنظیمات/).click();
  await page.getByLabel("کف دستی").fill("0");
  await tab(page, /برنامه/).click();
  await arrange(page).click();
  await expect(page.getByText(/ترکیب معتبر/)).toBeVisible();
});

test("FR-45: the week and exams download as a PNG", async ({ page }) => {
  await open(page);
  await addFirstCourse(page);
  await tab(page, /برنامه/).click();
  const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "دانلود تصویر (PNG)" }).click()]);
  expect(file.suggestedFilename()).toMatch(/^vahedchin-\d{4}-.+\.png$/);
  const bytes = readFileSync((await file.path())!);
  expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  expect(bytes.readUInt32BE(16)).toBe(2200); // 1100px at 2x
  expect(bytes.readUInt32BE(20)).toBeGreaterThan(600);
});

test("FR-07: scenarios move to another browser through a JSON file", async ({ page, browser }) => {
  await open(page);
  const name = await addFirstCourse(page);
  await tab(page, /تنظیمات/).click();
  const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /دانلود همه برنامه‌ها/ }).click()]);
  const path = (await file.path())!;
  const json = JSON.parse(readFileSync(path, "utf-8"));
  expect(json).toMatchObject({ app: "vahedchin", version: 1 });

  // A fresh browser profile: nothing stored yet.
  const other = await browser.newContext({ baseURL: "http://localhost:4173/vahedchin/", locale: "fa-IR" });
  const page2 = await other.newPage();
  await open(page2);
  await tab(page2, /تنظیمات/).click();
  await page2.getByLabel("فایل برنامه‌ها").setInputFiles(path);
  await expect(page2.getByText("۱ برنامه اضافه شد.")).toBeVisible();
  await tab(page2, /برنامه/).click();
  await expect(page2.locator(".course-row strong")).toHaveText(name);
  await expect(page2.getByLabel("برنامه", { exact: true })).toHaveValue(/.+/);

  await tab(page2, /تنظیمات/).click();
  await page2.getByLabel("فایل برنامه‌ها").setInputFiles({ name: "x.json", mimeType: "application/json", buffer: Buffer.from('{"app":"other"}') });
  await expect(page2.getByText("این فایل خروجی واحدچین نیست.")).toBeVisible();
  await other.close();
});
