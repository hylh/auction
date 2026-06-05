import { auctionInputSchema, fishInputSchema } from "../domain/validation";
import { DEMO_USERS } from "../domain/constants";
import { centsFromMajor } from "../domain/money";
import { gramsFromKilograms } from "../domain/weight";

export type Step = 1 | 2 | 3;

export const TOTAL_STEPS = 3;

/** Human-readable label for each wizard step. */
export const STEP_LABELS: Record<Step, string> = {
  1: "Fish details",
  2: "Pricing & seller",
  3: "Auction (optional)",
};

/** Field names that belong to each wizard step. */
export const STEP_FIELDS: Record<Step, readonly string[]> = {
  1: ["species", "displayName", "weightKilograms", "catchRegion", "grade"],
  2: ["startingPriceMajor", "sellerId", "description", "imageUrl"],
  3: ["startsAt", "endsAt", "minimumIncrementMajor"],
};

export type StepFieldErrors = Partial<Record<string, string>>;

/** Values shape compatible with InventoryFormState. */
export type StepValues = {
  species: string;
  displayName: string;
  weightKilograms: string;
  catchRegion: string;
  grade: string;
  startingPriceMajor: string;
  sellerId: string;
  description: string;
  imageUrl: string;
  createAuction: boolean;
  startsAt: string;
  endsAt: string;
  minimumIncrementMajor: string;
};

/** Clamp an arbitrary number to the valid step range [1, 3]. */
export function clampStep(n: number): Step {
  return Math.max(1, Math.min(TOTAL_STEPS, n)) as Step;
}

/**
 * Returns true only when every field owned by the given step has no error.
 * Errors on fields belonging to other steps are ignored.
 */
export function canAdvance(step: Step, fieldErrors: StepFieldErrors): boolean {
  return STEP_FIELDS[step].every((f) => !fieldErrors[f]);
}

/**
 * Validate only the fields that belong to `step`.
 * Reuses the shared Zod schemas and mirrors the friendly-message overrides
 * from the route's validateForm so behaviour is consistent.
 */
export function validateStep(step: Step, values: StepValues): StepFieldErrors {
  const errors: StepFieldErrors = {};

  if (step === 1) {
    const step1Schema = fishInputSchema.pick({
      species: true,
      displayName: true,
      weightKilograms: true,
      catchRegion: true,
      grade: true,
    });

    const result = step1Schema.safeParse({
      species: values.species,
      displayName: values.displayName,
      weightKilograms: values.weightKilograms,
      catchRegion: values.catchRegion,
      grade: values.grade,
    });

    if (!result.success) {
      for (const [field, messages] of Object.entries(result.error.flatten().fieldErrors)) {
        if (messages?.[0]) errors[field] = messages[0];
      }
    }

    // Mirror the friendly override from validateForm.
    try {
      gramsFromKilograms(values.weightKilograms);
    } catch (e) {
      errors.weightKilograms = e instanceof Error ? e.message : "Invalid weight";
    }
  }

  if (step === 2) {
    const step2Schema = fishInputSchema.pick({
      startingPriceMajor: true,
      sellerId: true,
      description: true,
      imageUrl: true,
    });

    const result = step2Schema.safeParse({
      startingPriceMajor: values.startingPriceMajor,
      sellerId: values.sellerId,
      description: values.description,
      imageUrl: values.imageUrl,
    });

    if (!result.success) {
      for (const [field, messages] of Object.entries(result.error.flatten().fieldErrors)) {
        if (messages?.[0]) errors[field] = messages[0];
      }
    }

    // Mirror the friendly override from validateForm.
    try {
      centsFromMajor(values.startingPriceMajor);
    } catch (e) {
      errors.startingPriceMajor = e instanceof Error ? e.message : "Invalid starting price";
    }
  }

  if (step === 3 && values.createAuction) {
    let minimumIncrementCents = 0;
    try {
      minimumIncrementCents = centsFromMajor(values.minimumIncrementMajor);
    } catch (e) {
      errors.minimumIncrementMajor = e instanceof Error ? e.message : "Invalid minimum increment";
    }

    const dummyFishItemId = "00000000-0000-4000-8000-000000000099";
    const result = auctionInputSchema.safeParse({
      fishItemId: dummyFishItemId,
      adminUserId: DEMO_USERS.admin,
      startsAt: values.startsAt,
      endsAt: values.endsAt,
      minimumIncrementCents,
    });

    if (!result.success) {
      const fe = result.error.flatten().fieldErrors;
      if (fe.startsAt?.[0]) errors.startsAt = fe.startsAt[0];
      if (fe.endsAt?.[0]) errors.endsAt = fe.endsAt[0];
      if (fe.minimumIncrementCents?.[0] && !errors.minimumIncrementMajor) {
        errors.minimumIncrementMajor = fe.minimumIncrementCents[0];
      }
    }

    if (values.endsAt && new Date(values.endsAt) <= new Date()) {
      errors.endsAt = "Auction end time must be in the future";
    }
  }

  return errors;
}
