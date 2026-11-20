import { expect, test } from "@playwright/test";
import { open, tab } from "./helpers";

test("manual activities persist and settings expose final semester and instructor choices", async ({ page }) => {
  await open(page);
  await tab(page, /برنامه/).click();
  await page.getByLabel("عنوان", { exact: true }).fill("حل تمرین شخصی");
  await page.getByRole("button", { name: "افزودن", exact: true }).click();
  await expect(page.locator(".week")).toContainText("حل تمرین شخصی");
  await page.reload();
  await expect(page.locator(".week")).toContainText("حل تمرین شخصی");
  await tab(page, /تنظیمات/).click();
  await page.getByLabel("اجازه تداخل کلاس‌ها در چیدمان خودکار").check();
  await expect(page.getByRole("combobox", { name: "استاد ترجیحی", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "استادانی که نمی‌خواهم", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("اجازه تداخل کلاس‌ها در چیدمان خودکار")).toBeChecked();
});

test("directory displays sourced contacts", async ({ page }) => {
  await open(page);
  await tab(page, /۱۱۸/).click();
  await expect(page.getByRole("heading", { name: "دفتر تلفن ۱۱۸ دانشگاه" })).toBeVisible();
  await expect(page.locator("article.card").first()).toBeVisible();
});


test("excellent standing resets an old manual cap and allows 24 credits", async ({ page }) => {
  await open(page);
  await tab(page, /تنظیمات/).click();
  await page.getByLabel("سقف دستی").fill("۲۰");
  await page.getByLabel("یا معدل ترم قبل").fill("۱۵");
  await page.getByRole("radio", { name: /معدل الف/ }).check();
  await expect(page.getByLabel("سقف دستی")).toHaveValue("");
  await expect(page.getByLabel("یا معدل ترم قبل")).toHaveValue("");
  await expect(page.getByText("واحد مجاز: ۱۲–۲۴")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("radio", { name: /معدل الف/ })).toBeChecked();
  await expect(page.getByText("واحد مجاز: ۱۲–۲۴")).toBeVisible();
});
