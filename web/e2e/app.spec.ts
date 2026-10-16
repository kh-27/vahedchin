import { expect, test } from "@playwright/test";
import { addFirstCourse, arrange, open, storedPicks, tab } from "./helpers";

test("FR-70: term and data time are shown", async ({ page }) => {
  await open(page);
  await expect(page.locator("header.top")).toContainText(/نیمسال (اول|دوم) سال تحصیلی/);
  await expect(page.locator("header.top")).toContainText(/ساعت [۰-۹]{2}:[۰-۹]{2}/);
});

test("FR-48: search across all courses accepts Arabic letters and Persian digits", async ({ page }) => {
  await open(page);
  await tab(page, /دروس/).click();
  await page.getByRole("searchbox").fill("رياضي");
  await expect(page.locator("li.course .course-name").first()).toContainText("ریاضی");
  await expect(page.locator("section p.muted.small")).toHaveText(/^[۰-۹]+\+? درس$/);
});

test("FR-47, FR-42, FR-40, FR-44: pick a group, see it in the week, keep it after reload", async ({ page }) => {
  await open(page);
  const name = await addFirstCourse(page);
  await tab(page, /برنامه/).click();
  await expect(page.locator(".course-row")).toHaveCount(1);
  await expect(page.locator(".course-row strong")).toHaveText(name);
  await expect(page.locator(".week .block").first()).toBeVisible();
  const picked = await page.locator(".course-row select").inputValue();
  expect(picked).toMatch(/^\d{7}_\d{2}$/);

  // The pick is in IndexedDB before the page goes away.
  await expect.poll(() => page.evaluate(storedPicks)).toEqual([picked]);
  await page.reload();
  await expect(page.locator(".course-row")).toHaveCount(1);
  await expect(page.locator(".course-row select")).toHaveValue(picked);
});

test("FR-30, FR-31, FR-34: generate in the worker and apply a result", async ({ page }) => {
  await open(page);
  await addFirstCourse(page);
  await tab(page, /تنظیمات/).click();
  await page.getByLabel("کف دستی").fill("۰");
  await tab(page, /برنامه/).click();
  await arrange(page).click();
  await expect(page.getByText(/ترکیب معتبر/)).toBeVisible();
  await expect(page.getByText(/زمان محاسبه: [۰-۹]+ میلی‌ثانیه/)).toBeVisible();
  await page.getByRole("button", { name: "انتخاب این برنامه" }).first().click();
  await expect(tab(page, /برنامه/)).toHaveAttribute("aria-current", "page");
});

test("FR-33: an impossible plan explains why", async ({ page }) => {
  await open(page);
  await addFirstCourse(page);
  // one course cannot reach the default floor of 12 units
  await tab(page, /برنامه/).click();
  await arrange(page).click();
  await expect(page.getByText("هیچ ترکیب معتبری پیدا نشد.")).toBeVisible();
  await expect(page.getByText(/کف .*واحد/)).toBeVisible();
});

test("NFR-04: nothing about the user is sent over the network", async ({ page }) => {
  const requests: { method: string; url: string }[] = [];
  page.on("request", (r) => requests.push({ method: r.method(), url: r.url() }));
  await open(page);
  const loaded = requests.length;

  await addFirstCourse(page);
  await tab(page, /تنظیمات/).click();
  await page.getByLabel("یا معدل ترم قبل").fill("۱۷٫۵");
  await page.getByLabel("کف دستی").fill("0");
  await page.getByLabel("خواهران").check();
  await tab(page, /برنامه/).click();
  await arrange(page).click();
  await expect(page.getByText(/ترکیب معتبر/)).toBeVisible();

  const origin = new URL(page.url()).origin;
  for (const r of requests) {
    expect(r.method, r.url).toBe("GET");
    expect(new URL(r.url).origin, r.url).toBe(origin);
    expect(new URL(r.url).search, r.url).toBe("");
  }
  // After the first load only app files may be fetched: the worker script, the service worker, manifest and icons.
  for (const r of requests.slice(loaded))
    expect(new URL(r.url).pathname, r.url).toMatch(/^\/vahedchin\/(assets\/[\w.-]+\.js|sw\.js|manifest\.webmanifest|icons\/[\w.-]+\.png)$/);
});

test("NFR-08: no horizontal scrolling on any tab", async ({ page }) => {
  await open(page);
  await addFirstCourse(page);
  for (const name of [/دروس/, /برنامه/, /چیدن خودکار/, /تنظیمات/]) {
    await tab(page, name).click();
    const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(sw, String(name)).toBeLessThanOrEqual(cw);
  }
});
