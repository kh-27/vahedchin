import { describe, expect, it } from "vitest";
import { fa, faDate, faDayDate, faNumber, faReportTime, fold, latinDigits, matches } from "./text";

describe("FR-50 digits", () => {
  it("shows Persian digits", () => {
    expect(fa("12:30")).toBe("۱۲:۳۰");
    expect(fa(1118061)).toBe("۱۱۱۸۰۶۱");
    expect(faNumber(0.5)).toBe("۰٫۵");
  });
  it("accepts Persian and Arabic digits", () => {
    expect(latinDigits("۱۱۱۸۰۶۱_٠١")).toBe("1118061_01");
  });
});

describe("FR-48 search", () => {
  it("folds Arabic letters, ZWNJ and diacritics", () => {
    expect(fold("شيمي عمومي")).toBe(fold("شیمی عمومی"));
    expect(fold("مهندسیِ مكانیک")).toBe("مهندسی مکانیک");
    expect(fold("آزمایشگاه‌ها")).toBe("آزمایشگاهها");
  });
  it("matches every word, in any order, ignoring spaces", () => {
    expect(matches("شیمی عمومی", "عمومی شیمی")).toBe(true);
    expect(matches("شیمی عمومی", "شیمی عمو")).toBe(true);
    expect(matches("آزمایشگاه شیمی عمومی", "شیمیعمومی")).toBe(true);
    expect(matches("ریاضی مهندسی 1118061_01", "۱۱۱۸۰۶۱")).toBe(true);
    expect(matches("شیمی عمومی", "فیزیک")).toBe(false);
    expect(matches("هر چیز", "  ")).toBe(true);
  });
});

describe("FR-41, FR-70 dates", () => {
  it("formats Jalali dates", () => {
    expect(faDate("1405/04/06")).toBe("۶ تیر ۱۴۰۵");
    expect(faDayDate("1405/10/30")).toBe("چهارشنبه ۳۰ دی");
    expect(faReportTime("1405/07/24", "17:19")).toBe("۲۴ مهر ۱۴۰۵، ساعت ۱۷:۱۹");
  });
});
