import { test, expect } from "@playwright/test";

test("first visit, theme contrast and quick add by course code", async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  let release!: () => void;
  const loading = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/data/index.json", async (route) => { await loading; await route.continue(); });
  await page.goto("./");
  await expect(page.locator(".splash")).toBeVisible();
  release();
  const enter = page.getByRole("button", { name: "ورود به برنامه" });
  await expect(enter).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("entry.png") });
  await enter.click();
  const query = page.getByRole("searchbox");
  const catalog = await (await page.request.get("./data/index.json")).json();
  const term = await (await page.request.get("./data/" + catalog.terms[0].file)).json();
  const first = term.groups.find((g: {sessions: {day: number | null}[]}) => g.sessions.some((s) => s.day !== null));
  await query.fill(first.course.replace(/\d/g, (d: string) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]));
  await query.press("Enter");
  await expect(page.getByText("در برنامهٔ شماست")).toBeVisible();
  await page.locator(".course-title").click();
  await page.getByRole("button", { name: "گذاشتن در جدول" }).first().click();
  await page.locator("nav").getByRole("button", { name: /برنامه/ }).click();
  const block = page.locator(".week .block").first();
  for (const theme of ["dark", "light"]) {
    if (theme === "light") await page.getByRole("button", { name: /حالت روشن/ }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(block).toBeVisible();
    const contrast = await block.evaluate((element) => {
      const luminance = (rgb: string) => {
        const channels = rgb.match(/\d+/g)!.map(Number).map((n) => n / 255)
          .map((n) => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
        return channels[0]! * .2126 + channels[1]! * .7152 + channels[2]! * .0722;
      };
      const a = luminance(getComputedStyle(element).backgroundColor);
      const b = luminance(getComputedStyle(element).color);
      return (Math.max(a,b) + .05) / (Math.min(a,b) + .05);
    });
    expect(contrast).toBeGreaterThan(4.5);
    await page.locator(".week-scroll").screenshot({ path: testInfo.outputPath(theme + ".png") });
  }
  await page.reload();
  await expect(block).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator(".entry, .splash")).toHaveCount(0);
});
