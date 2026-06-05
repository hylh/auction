import { describe, expect, it } from "vitest";
import { centsFromMajor } from "./money";
import { gramsFromKilograms } from "./weight";

describe("money helpers", () => {
  it("converts whole NOK amounts to cents", () => {
    expect(centsFromMajor("1800")).toBe(180000);
    expect(centsFromMajor("100")).toBe(10000);
    expect(centsFromMajor(500)).toBe(50000);
  });

  it("rejects decimal values", () => {
    expect(() => centsFromMajor("123.45")).toThrow(
      "Money values must be whole numbers (no decimals or cents)",
    );
    expect(() => centsFromMajor("100.50")).toThrow(
      "Money values must be whole numbers (no decimals or cents)",
    );
    expect(() => centsFromMajor("")).toThrow(
      "Money values must be whole numbers (no decimals or cents)",
    );
  });
});

describe("weight helpers", () => {
  it("stores displayed kilograms as integer grams", () => {
    expect(gramsFromKilograms("12.345")).toBe(12345);
    expect(gramsFromKilograms("12,5")).toBe(12500);
  });

  it("rejects values with more than three decimals", () => {
    expect(() => gramsFromKilograms("1.2345")).toThrow(
      "Weight values must use kilograms with up to three decimals",
    );
  });
});
