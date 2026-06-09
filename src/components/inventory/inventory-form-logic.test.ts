import { describe, expect, it } from "vitest";
import {
  buildPreviews,
  initialFormState,
  validateForm,
  type ValidationResult,
} from "./inventory-form-logic";
import type { InventoryFormState } from "./types";

/** A fully valid form: listed inventory plus a future auction. */
function validValues(overrides: Partial<InventoryFormState> = {}): InventoryFormState {
  return {
    ...initialFormState(),
    sellerId: "00000000-0000-4000-8000-000000000001",
    createAuction: true,
    startsAt: "2099-06-01T10:00",
    endsAt: "2099-06-01T12:00",
    minimumIncrementMajor: "100",
    ...overrides,
  };
}

function expectOk(result: ValidationResult): Extract<ValidationResult, { ok: true }> {
  if (!result.ok) {
    throw new Error(`expected ok result, got errors: ${JSON.stringify(result.fieldErrors)}`);
  }
  return result;
}

describe("validateForm — fish details", () => {
  it("accepts a fully valid form", () => {
    const result = expectOk(validateForm(validValues()));
    expect(result.fishInput.species).toBe("salmon");
    expect(result.auctionInput).not.toBeNull();
  });

  it("rejects a blank display name", () => {
    const result = validateForm(validValues({ displayName: "" }));
    expect(result.ok).toBe(false);
    expect(result.fieldErrors.displayName).toBeDefined();
  });

  it("returns a friendly weight error for too many decimals", () => {
    const result = validateForm(validValues({ weightKilograms: "1.2345" }));
    expect(result.ok).toBe(false);
    expect(result.fieldErrors.weightKilograms).toMatch(/kilograms/i);
  });

  it("rejects a non-UUID seller", () => {
    const result = validateForm(validValues({ sellerId: "not-a-uuid" }));
    expect(result.ok).toBe(false);
    expect(result.fieldErrors.sellerId).toBeDefined();
  });

  it("returns a friendly starting-price error for too many decimals", () => {
    const result = validateForm(validValues({ startingPriceMajor: "10.999" }));
    expect(result.ok).toBe(false);
    expect(result.fieldErrors.startingPriceMajor).toMatch(/decimal/i);
  });
});

describe("validateForm — auction", () => {
  it("lists inventory only when createAuction is false", () => {
    const result = expectOk(
      validateForm(validValues({ createAuction: false, startsAt: "", endsAt: "" })),
    );
    expect(result.auctionInput).toBeNull();
  });

  it("rejects an auction ending in the past", () => {
    const result = validateForm(validValues({ endsAt: "2000-01-01T00:00" }));
    expect(result.ok).toBe(false);
    expect(result.fieldErrors.endsAt).toBeDefined();
  });

  it("rejects an invalid minimum increment", () => {
    const result = validateForm(validValues({ minimumIncrementMajor: "abc" }));
    expect(result.ok).toBe(false);
    expect(result.fieldErrors.minimumIncrementMajor).toBeDefined();
  });

  it("builds an auction input carrying the parsed increment", () => {
    const result = expectOk(validateForm(validValues({ minimumIncrementMajor: "250" })));
    expect(result.auctionInput?.minimumIncrementCents).toBe(25_000);
  });
});

describe("buildPreviews", () => {
  it("renders weight and price previews for valid input", () => {
    const previews = buildPreviews(
      validValues({ weightKilograms: "10", startingPriceMajor: "500" }),
    );
    expect(previews.weight).toMatch(/grams/i);
    expect(previews.startingPrice).toMatch(/500/);
    expect(previews.weightError).toBeNull();
  });

  it("reports an error for an invalid image URL", () => {
    const previews = buildPreviews(validValues({ imageUrl: "not-a-url" }));
    expect(previews.imageUrl).toBeNull();
    expect(previews.imageError).toBeDefined();
  });

  it("accepts an http(s) image URL", () => {
    const previews = buildPreviews(validValues({ imageUrl: "https://example.com/fish.jpg" }));
    expect(previews.imageUrl).toBe("https://example.com/fish.jpg");
    expect(previews.imageError).toBeNull();
  });

  it("rejects a non-http image URL", () => {
    const previews = buildPreviews(validValues({ imageUrl: "ftp://example.com/fish.jpg" }));
    expect(previews.imageError).toMatch(/http/i);
  });
});
