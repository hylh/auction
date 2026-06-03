import { describe, expect, it } from "vitest";
import { centsFromMajor } from "./money";
import { gramsFromKilograms } from "./weight";

describe("money helpers", () => {
  it("stores money as integer cents", () => {
    expect(centsFromMajor("123.45")).toBe(12345);
    expect(centsFromMajor("123")).toBe(12300);
  });

  it("rejects values with more than two decimals", () => {
    expect(() => centsFromMajor("10.999")).toThrow(
      "Money values must use at most two decimal places",
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
