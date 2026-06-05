import { expect, type Page, type TestInfo } from "@playwright/test";

export function uniqueFishName(prefix: string, testInfo: TestInfo): string {
  return `${prefix} ${testInfo.workerIndex}-${Date.now()}`;
}

/**
 * Asserts the document does not overflow horizontally at the current viewport.
 * A 1px tolerance absorbs sub-pixel rounding.
 */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });
  expect(overflow, "page should not scroll horizontally").toBeLessThanOrEqual(1);
}
