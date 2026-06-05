import type { TestInfo } from "@playwright/test";

export function uniqueFishName(prefix: string, testInfo: TestInfo): string {
  return `${prefix} ${testInfo.workerIndex}-${Date.now()}`;
}
