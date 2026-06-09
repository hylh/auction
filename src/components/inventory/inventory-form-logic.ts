import { DEMO_USERS } from "../../domain/constants";
import { centsFromMajor, formatMoney } from "../../domain/money";
import { auctionInputSchema, fishInputSchema } from "../../domain/validation";
import { formatKilograms, gramsFromKilograms } from "../../domain/weight";
import type { FieldErrors, InventoryFormState } from "./types";

const dummyFishItemId = "00000000-0000-4000-8000-000000000099";

type AuctionInput = {
  fishItemId: string;
  adminUserId: string;
  startsAt: string;
  endsAt: string;
  minimumIncrementCents: number;
};

export type ValidationResult =
  | {
      ok: true;
      fieldErrors: FieldErrors;
      fishInput: Record<string, string>;
      auctionInput: AuctionInput | null;
    }
  | { ok: false; fieldErrors: FieldErrors };

export function validateForm(values: InventoryFormState): ValidationResult {
  const fieldErrors: FieldErrors = {};
  const fishInput = {
    species: values.species,
    displayName: values.displayName,
    weightKilograms: values.weightKilograms,
    catchRegion: values.catchRegion,
    grade: values.grade,
    startingPriceMajor: values.startingPriceMajor,
    sellerId: values.sellerId,
    description: values.description,
    imageUrl: values.imageUrl,
  };
  const parsedFish = fishInputSchema.safeParse(fishInput);

  if (!parsedFish.success) {
    Object.assign(fieldErrors, flattenFieldErrors(parsedFish.error.flatten().fieldErrors));
  }

  try {
    gramsFromKilograms(values.weightKilograms);
  } catch (error) {
    fieldErrors.weightKilograms = error instanceof Error ? error.message : "Invalid weight";
  }

  try {
    centsFromMajor(values.startingPriceMajor);
  } catch (error) {
    fieldErrors.startingPriceMajor =
      error instanceof Error ? error.message : "Invalid starting price";
  }

  let auctionInput: AuctionInput | null = null;

  if (values.createAuction) {
    let minimumIncrementCents = 0;
    try {
      minimumIncrementCents = centsFromMajor(values.minimumIncrementMajor);
    } catch (error) {
      fieldErrors.minimumIncrementMajor =
        error instanceof Error ? error.message : "Invalid minimum increment";
    }

    const auctionCandidate = {
      fishItemId: dummyFishItemId,
      adminUserId: DEMO_USERS.admin,
      startsAt: values.startsAt,
      endsAt: values.endsAt,
      minimumIncrementCents,
    };
    const parsedAuction = auctionInputSchema.safeParse(auctionCandidate);
    if (!parsedAuction.success) {
      const auctionErrors = flattenFieldErrors(parsedAuction.error.flatten().fieldErrors);
      Object.assign(fieldErrors, auctionErrors);
      const incrementError = (auctionErrors as Record<string, string | undefined>)
        .minimumIncrementCents;
      if (incrementError) {
        fieldErrors.minimumIncrementMajor = incrementError;
      }
    }
    if (new Date(values.endsAt) <= new Date()) {
      fieldErrors.endsAt = "Auction end time must be in the future";
    }
    auctionInput = auctionCandidate;
  }

  if (Object.keys(fieldErrors).length > 0 || !parsedFish.success) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    fieldErrors,
    fishInput,
    auctionInput,
  };
}

export function flattenFieldErrors(
  errors: Record<string, Array<string> | undefined>,
): FieldErrors {
  return Object.fromEntries(
    Object.entries(errors)
      .filter(([, messages]) => messages?.[0])
      .map(([field, messages]) => [field, messages?.[0]]),
  ) as FieldErrors;
}

export type FormPreviews = ReturnType<typeof buildPreviews>;

export function buildPreviews(values: InventoryFormState) {
  const weight = safePreview(values.weightKilograms, (value) => {
    const grams = gramsFromKilograms(value);
    return `Will store ${grams.toLocaleString("en-GB")} grams (${formatKilograms(grams)}).`;
  });
  const startingPrice = safePreview(values.startingPriceMajor, (value) => {
    const cents = centsFromMajor(value);
    return `Starting price: ${formatMoney(cents)}.`;
  });
  const minimumIncrement = safePreview(values.minimumIncrementMajor, (value) => {
    const cents = centsFromMajor(value);
    return `Minimum increment: ${formatMoney(cents)}.`;
  });

  return {
    weight: weight.preview,
    weightError: weight.error,
    startingPrice: startingPrice.preview,
    startingPriceError: startingPrice.error,
    minimumIncrement: minimumIncrement.preview,
    minimumIncrementError: minimumIncrement.error,
    ...imagePreview(values.imageUrl),
  };
}

function safePreview(value: string, parse: (value: string) => string) {
  if (!value.trim()) {
    return { preview: null, error: null };
  }

  try {
    return { preview: parse(value), error: null };
  } catch (error) {
    return { preview: null, error: error instanceof Error ? error.message : "Invalid value" };
  }
}

function imagePreview(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return { imageUrl: null, imageError: null };
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { imageUrl: null, imageError: "Image preview requires an http(s) URL" };
    }
    return { imageUrl: url.toString(), imageError: null };
  } catch {
    return { imageUrl: null, imageError: "Enter a valid URL to preview the image" };
  }
}

export function initialFormState(): InventoryFormState {
  return {
    species: "salmon",
    displayName: "Morning catch salmon crate",
    weightKilograms: "42.5",
    catchRegion: "Lofoten",
    grade: "A",
    startingPriceMajor: "1800",
    sellerId: "",
    description: "Packed in ice and ready for same-day auction.",
    imageUrl: "",
    createAuction: true,
    startsAt: "",
    endsAt: "",
    minimumIncrementMajor: "100",
  };
}

export function defaultAuctionWindow() {
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + 30 * 60_000);
  return {
    startsAt: toLocalDateTimeInput(startsAt),
    endsAt: toLocalDateTimeInput(endsAt),
  };
}

function toLocalDateTimeInput(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
