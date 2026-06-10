import { describe, expect, it } from "vitest";
import { escapeHtml, formatBytes, formatSeconds } from "./metrics-format";

describe("metrics formatting", () => {
  it("formats sub-second and second durations", () => {
    expect(formatSeconds(0.125)).toBe("125 ms");
    expect(formatSeconds(1)).toBe("1.00 s");
    expect(formatSeconds(12.345)).toBe("12.35 s");
  });

  it("formats byte values across units", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1.00 KB");
    expect(formatBytes(10 * 1024)).toBe("10.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.00 MB");
    expect(formatBytes(3 * 1024 * 1024 * 1024)).toBe("3.00 GB");
    expect(formatBytes(2 * 1024 * 1024 * 1024 * 1024)).toBe("2.00 TB");
  });

  it("escapes HTML-sensitive characters", () => {
    expect(escapeHtml(`<fish data-kind="cod">Bob's catch & sale</fish>`)).toBe(
      "&lt;fish data-kind=&quot;cod&quot;&gt;Bob&#39;s catch &amp; sale&lt;/fish&gt;",
    );
  });
});
