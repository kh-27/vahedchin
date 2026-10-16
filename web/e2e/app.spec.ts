import { expect, test, type Page } from "@playwright/test";

async function open(page: Page) {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "واحدچین" })).toBeVisible();
  await expect(page.getByText("داده گلستان:")).toBeVisible();
}

/** Picked group codes as stored in IndexedDB (FR-44). */
const storedPicks = () =>
  new Promise<string[]>((resolve) => {
    const req = indexedDB.open("vahedchin", 1);
    req.onsuccess = () => {
      const get = req.result.transaction("state").objectStore("state").get("app");
      get.onsuccess = () => resolve(Object.values((get.result?.scenarios?.[0]?.picks ?? {}) as Record<string, string>));
      get.onerror = () => resolve([]);
    };
    req.onerror = () => resolve([]);
  });

const tab = (page: Page, name: RegExp) => page.locator("nav.tabs").getByRole("button", { name });
const arrange = (page: Page) => page.locator("section").getByRole("button", { name: "چیدن خودکار" });

/** Pick the first faculty and its first department/level, add its first course that has weekly classes. */
async function addFirstCourse(page: Page): Promise<string> {
  await tab(page, /دروس/).click();
  await page.getByLabel("دانشکده").selectOption({ index: 1 });
  await page.getByLabel("گروه آموزشی و مقطع").selectOption({ index: 1 });
  const cards = page.locator("li.course");
  await expect(cards.first()).toBeVisible();
  const n = await cards.count();
  for (let i = 0; i < n; i++) {
    const card = cards.nth(i);
    await card.locator(".course-title").click();
    const withTimes = card.locator(".groups > li").filter({ hasNotText: "بدون ساعت هفتگی" });
    if ((await withTimes.count()) > 0) {
      const name = (await card.locator(".course-name").textContent()) ?? "";
      await card.getByRole("button", { name: "افزودن" }).click();
      await withTimes.first().getByRole("button", { name: "گذاشتن در جدول" }).click();
      return name;
    }
    await card.locator(".course-title").click();
  }
  throw new Error("no course with weekly classes in the first department");
}

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
  // After the first load only the worker's script may be fetched.
  for (const r of requests.slice(loaded)) expect(new URL(r.url).pathname, r.url).toMatch(/^\/vahedchin\/assets\/[\w.-]+\.js$/);
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
