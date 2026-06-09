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

const DUMMY_FISH_ITEM_ID = "00000000-0000-4000-8000-000000000099";

/**
 * Validate only the fields that belong to `step`.
 * Reuses the shared Zod schemas and mirrors the friendly-message overrides
 * from the route's validateForm so behaviour is consistent.
 */
export function validateStep(step: Step, values: StepValues): StepFieldErrors {
  if (step === 1) return validateFishDetailsStep(values);
  if (step === 2) return validatePricingStep(values);
  if (step === 3) return validateAuctionStep(values);
  return {};
}

/** Copy the first message of each Zod field error into the target map. */
function collectZodFieldErrors(
  fieldErrors: Record<string, Array<string> | undefined>,
  target: StepFieldErrors,
) {
  for (const [field, messages] of Object.entries(fieldErrors)) {
    if (messages?.[0]) target[field] = messages[0];
  }
}

/** Run a parser purely for its thrown message, recording it under `field`. */
function recordParseError(
  errors: StepFieldErrors,
  field: string,
  parse: () => void,
  fallback: string,
) {
  try {
    parse();
  } catch (e) {
    errors[field] = e instanceof Error ? e.message : fallback;
  }
}

function validateFishDetailsStep(values: StepValues): StepFieldErrors {
  const errors: StepFieldErrors = {};
  const result = fishInputSchema
    .pick({ species: true, displayName: true, weightKilograms: true, catchRegion: true, grade: true })
    .safeParse({
      species: values.species,
      displayName: values.displayName,
      weightKilograms: values.weightKilograms,
      catchRegion: values.catchRegion,
      grade: values.grade,
    });

  if (!result.success) collectZodFieldErrors(result.error.flatten().fieldErrors, errors);
  recordParseError(
    errors,
    "weightKilograms",
    () => gramsFromKilograms(values.weightKilograms),
    "Invalid weight",
  );
  return errors;
}

function validatePricingStep(values: StepValues): StepFieldErrors {
  const errors: StepFieldErrors = {};
  const result = fishInputSchema
    .pick({ startingPriceMajor: true, sellerId: true, description: true, imageUrl: true })
    .safeParse({
      startingPriceMajor: values.startingPriceMajor,
      sellerId: values.sellerId,
      description: values.description,
      imageUrl: values.imageUrl,
    });

  if (!result.success) collectZodFieldErrors(result.error.flatten().fieldErrors, errors);
  recordParseError(
    errors,
    "startingPriceMajor",
    () => centsFromMajor(values.startingPriceMajor),
    "Invalid starting price",
  );
  return errors;
}

function validateAuctionStep(values: StepValues): StepFieldErrors {
  if (!values.createAuction) return {};

  const errors: StepFieldErrors = {};
  let minimumIncrementCents = 0;
  recordParseError(
    errors,
    "minimumIncrementMajor",
    () => {
      minimumIncrementCents = centsFromMajor(values.minimumIncrementMajor);
    },
    "Invalid minimum increment",
  );

  const result = auctionInputSchema.safeParse({
    fishItemId: DUMMY_FISH_ITEM_ID,
    adminUserId: DEMO_USERS.admin,
    startsAt: values.startsAt,
    endsAt: values.endsAt,
    minimumIncrementCents,
  });
  if (!result.success) {
    mapAuctionFieldErrors(result.error.flatten().fieldErrors, errors);
  }

  if (values.endsAt && new Date(values.endsAt) <= new Date()) {
    errors.endsAt = "Auction end time must be in the future";
  }
  return errors;
}

/** Map auction-schema errors onto step field keys, keeping friendly overrides. */
function mapAuctionFieldErrors(
  fe: Record<string, Array<string> | undefined>,
  errors: StepFieldErrors,
) {
  if (fe.startsAt?.[0]) errors.startsAt = fe.startsAt[0];
  if (fe.endsAt?.[0]) errors.endsAt = fe.endsAt[0];
  if (fe.minimumIncrementCents?.[0] && !errors.minimumIncrementMajor) {
    errors.minimumIncrementMajor = fe.minimumIncrementCents[0];
  }
}
