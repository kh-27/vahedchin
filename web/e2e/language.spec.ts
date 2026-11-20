import { expect, test } from "@playwright/test";
import { open } from "./helpers";

test("language switches translate navigation, direction, and persist after reload", async ({ page }) => {
  await open(page);
  const language = page.getByLabel("Language / اللغة / زبان");
  await language.selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByText("Credit limits")).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await language.selectOption("ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("button", { name: "الإعدادات", exact: true })).toBeVisible();
  await expect(page.getByText("حدود الوحدات")).toBeVisible();
  await language.selectOption("fa");
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
});
