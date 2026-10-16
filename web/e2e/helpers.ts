import { expect, type Page } from "@playwright/test";

export async function open(page: Page) {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "واحدچین" })).toBeVisible();
  await expect(page.getByText("داده گلستان:")).toBeVisible();
}

/** Picked group codes as stored in IndexedDB (FR-44). */
export const storedPicks = () =>
  new Promise<string[]>((resolve) => {
    const req = indexedDB.open("vahedchin", 1);
    req.onsuccess = () => {
      const get = req.result.transaction("state").objectStore("state").get("app");
      get.onsuccess = () => resolve(Object.values((get.result?.scenarios?.[0]?.picks ?? {}) as Record<string, string>));
      get.onerror = () => resolve([]);
    };
    req.onerror = () => resolve([]);
  });

export const tab = (page: Page, name: RegExp) => page.locator("nav.tabs").getByRole("button", { name });
export const arrange = (page: Page) => page.locator("section").getByRole("button", { name: "چیدن خودکار" });

/** Pick the first faculty and its first department/level, add its first course that has weekly classes. */
export async function addFirstCourse(page: Page): Promise<string> {
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
