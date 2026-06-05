import { describe, expect, it } from "vitest";
import {
  STEP_FIELDS,
  TOTAL_STEPS,
  canAdvance,
  clampStep,
  validateStep,
  type StepValues,
} from "./inventory-new-stepper";

/** Minimal valid values for all form fields. */
const validValues: StepValues = {
  species: "salmon",
  displayName: "Arctic Salmon Crate",
  weightKilograms: "42.5",
  catchRegion: "Lofoten",
  grade: "A",
  startingPriceMajor: "1800",
  sellerId: "00000000-0000-4000-8000-000000000001",
  description: "",
  imageUrl: "",
  createAuction: false,
  startsAt: "2099-06-01T10:00",
  endsAt: "2099-06-01T12:00",
  minimumIncrementMajor: "100",
};

// ── STEP_FIELDS ────────────────────────────────────────────────────────────────

describe("STEP_FIELDS", () => {
  it(`covers exactly ${TOTAL_STEPS} steps`, () => {
    expect(Object.keys(STEP_FIELDS)).toHaveLength(TOTAL_STEPS);
  });

  it("assigns fish-detail fields to step 1", () => {
    expect(STEP_FIELDS[1]).toContain("species");
    expect(STEP_FIELDS[1]).toContain("displayName");
    expect(STEP_FIELDS[1]).toContain("weightKilograms");
    expect(STEP_FIELDS[1]).toContain("catchRegion");
    expect(STEP_FIELDS[1]).toContain("grade");
  });

  it("assigns pricing/seller fields to step 2", () => {
    expect(STEP_FIELDS[2]).toContain("startingPriceMajor");
    expect(STEP_FIELDS[2]).toContain("sellerId");
  });

  it("assigns auction fields to step 3", () => {
    expect(STEP_FIELDS[3]).toContain("startsAt");
    expect(STEP_FIELDS[3]).toContain("endsAt");
    expect(STEP_FIELDS[3]).toContain("minimumIncrementMajor");
  });
});

// ── clampStep ──────────────────────────────────────────────────────────────────

describe("clampStep", () => {
  it("clamps below 1 to 1", () => {
    expect(clampStep(0)).toBe(1);
    expect(clampStep(-99)).toBe(1);
  });

  it(`clamps above ${TOTAL_STEPS} to ${TOTAL_STEPS}`, () => {
    expect(clampStep(4)).toBe(3);
    expect(clampStep(999)).toBe(3);
  });

  it("passes through valid step values unchanged", () => {
    expect(clampStep(1)).toBe(1);
    expect(clampStep(2)).toBe(2);
    expect(clampStep(3)).toBe(3);
  });
});

// ── canAdvance ─────────────────────────────────────────────────────────────────

describe("canAdvance", () => {
  it("returns true when there are no field errors at all", () => {
    expect(canAdvance(1, {})).toBe(true);
    expect(canAdvance(2, {})).toBe(true);
    expect(canAdvance(3, {})).toBe(true);
  });

  it("returns false when a step-1 field has an error", () => {
    expect(canAdvance(1, { species: "Required" })).toBe(false);
    expect(canAdvance(1, { displayName: "Too short" })).toBe(false);
    expect(canAdvance(1, { weightKilograms: "Invalid weight" })).toBe(false);
  });

  it("returns false when a step-2 field has an error", () => {
    expect(canAdvance(2, { startingPriceMajor: "Required" })).toBe(false);
    expect(canAdvance(2, { sellerId: "Choose a seller" })).toBe(false);
  });

  it("returns false when a step-3 field has an error", () => {
    expect(canAdvance(3, { endsAt: "Must be in the future" })).toBe(false);
  });

  it("step-1 advance is NOT blocked by errors on step-2 fields", () => {
    expect(canAdvance(1, { startingPriceMajor: "Required" })).toBe(true);
    expect(canAdvance(1, { sellerId: "Required" })).toBe(true);
  });

  it("step-2 advance is NOT blocked by errors on step-1 or step-3 fields", () => {
    expect(canAdvance(2, { displayName: "Too short" })).toBe(true);
    expect(canAdvance(2, { endsAt: "Past date" })).toBe(true);
  });

  it("step-3 advance is NOT blocked by errors on step-1 or step-2 fields", () => {
    expect(canAdvance(3, { displayName: "Too short" })).toBe(true);
    expect(canAdvance(3, { startingPriceMajor: "Invalid" })).toBe(true);
  });
});

// ── validateStep ───────────────────────────────────────────────────────────────

describe("validateStep — step 1 (fish details)", () => {
  it("returns no errors for valid step-1 values", () => {
    expect(validateStep(1, validValues)).toEqual({});
  });

  it("returns an error for a blank displayName", () => {
    const errors = validateStep(1, { ...validValues, displayName: "" });
    expect(errors.displayName).toBeDefined();
  });

  it("returns an error for a displayName that is too short", () => {
    const errors = validateStep(1, { ...validValues, displayName: "X" });
    expect(errors.displayName).toBeDefined();
  });

  it("returns an error for an invalid weight (text)", () => {
    const errors = validateStep(1, { ...validValues, weightKilograms: "abc" });
    expect(errors.weightKilograms).toBeDefined();
  });

  it("returns a friendly error for too many weight decimals", () => {
    const errors = validateStep(1, { ...validValues, weightKilograms: "1.2345" });
    expect(errors.weightKilograms).toMatch(/kilograms/i);
  });

  it("returns an error for an invalid species", () => {
    const errors = validateStep(1, { ...validValues, species: "dolphin" });
    expect(errors.species).toBeDefined();
  });

  it("does NOT flag step-2 fields even when they are blank", () => {
    const errors = validateStep(1, {
      ...validValues,
      startingPriceMajor: "",
      sellerId: "",
    });
    expect(errors.startingPriceMajor).toBeUndefined();
    expect(errors.sellerId).toBeUndefined();
  });
});

describe("validateStep — step 2 (pricing & seller)", () => {
  it("returns no errors for valid step-2 values", () => {
    expect(validateStep(2, validValues)).toEqual({});
  });

  it("returns an error for a blank sellerId", () => {
    const errors = validateStep(2, { ...validValues, sellerId: "" });
    expect(errors.sellerId).toBeDefined();
  });

  it("returns an error for a non-UUID sellerId", () => {
    const errors = validateStep(2, { ...validValues, sellerId: "not-a-uuid" });
    expect(errors.sellerId).toBeDefined();
  });

  it("returns a friendly error for an invalid starting price", () => {
    const errors = validateStep(2, { ...validValues, startingPriceMajor: "abc" });
    expect(errors.startingPriceMajor).toBeDefined();
  });

  it("returns an error for a startingPrice with too many decimals", () => {
    const errors = validateStep(2, { ...validValues, startingPriceMajor: "10.999" });
    expect(errors.startingPriceMajor).toMatch(/decimal/i);
  });

  it("returns an error for an invalid imageUrl", () => {
    const errors = validateStep(2, { ...validValues, imageUrl: "not-a-url" });
    expect(errors.imageUrl).toBeDefined();
  });

  it("accepts a blank imageUrl (field is optional)", () => {
    const errors = validateStep(2, { ...validValues, imageUrl: "" });
    expect(errors.imageUrl).toBeUndefined();
  });

  it("does NOT flag step-1 fields even when they are blank", () => {
    const errors = validateStep(2, {
      ...validValues,
      displayName: "",
      weightKilograms: "",
    });
    expect(errors.displayName).toBeUndefined();
    expect(errors.weightKilograms).toBeUndefined();
  });
});

describe("validateStep — step 3 (auction)", () => {
  it("returns no errors when createAuction is false regardless of auction fields", () => {
    const errors = validateStep(3, {
      ...validValues,
      createAuction: false,
      startsAt: "",
      endsAt: "",
      minimumIncrementMajor: "",
    });
    expect(errors).toEqual({});
  });

  it("returns no errors for valid future auction dates", () => {
    const errors = validateStep(3, {
      ...validValues,
      createAuction: true,
    });
    expect(errors).toEqual({});
  });

  it("returns an error when endsAt is in the past", () => {
    const errors = validateStep(3, {
      ...validValues,
      createAuction: true,
      endsAt: "2000-01-01T00:00",
    });
    expect(errors.endsAt).toBeDefined();
  });

  it("returns an error for invalid minimumIncrementMajor", () => {
    const errors = validateStep(3, {
      ...validValues,
      createAuction: true,
      minimumIncrementMajor: "abc",
    });
    expect(errors.minimumIncrementMajor).toBeDefined();
  });

  it("returns an error when endsAt is before startsAt", () => {
    const errors = validateStep(3, {
      ...validValues,
      createAuction: true,
      startsAt: "2099-06-01T12:00",
      endsAt: "2099-06-01T10:00",
    });
    expect(errors.endsAt).toBeDefined();
  });

  it("does NOT flag step-1 or step-2 fields", () => {
    const errors = validateStep(3, {
      ...validValues,
      createAuction: true,
      displayName: "",
      startingPriceMajor: "",
    });
    expect(errors.displayName).toBeUndefined();
    expect(errors.startingPriceMajor).toBeUndefined();
  });
});
