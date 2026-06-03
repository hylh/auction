import { z } from "zod";
import { FISH_SPECIES } from "./constants";

export const uuidSchema = z.string().uuid();
export const speciesSchema = z.enum(FISH_SPECIES);
export const adminStatusSchema = z.enum([
  "draft",
  "listed",
  "in_auction",
  "sold",
  "withdrawn",
  "scheduled",
  "active",
  "closed",
  "unsold",
]);

const optionalDateSchema = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  z.coerce.date().optional(),
);

const optionalUuidSchema = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  uuidSchema.optional(),
);

const optionalSpeciesSchema = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  speciesSchema.optional(),
);

const optionalAdminStatusSchema = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  adminStatusSchema.optional(),
);

const optionalReasonSchema = z
  .string()
  .trim()
  .max(300)
  .optional()
  .or(z.literal(""))
  .transform((value) => value || undefined);

const decimalNumberSchema = (decimalPlaces: number, schema: z.ZodNumber) =>
  z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    const raw = value.trim();
    const decimalPattern = new RegExp(`^\\d+([,.]\\d{1,${decimalPlaces}})?$`);
    return decimalPattern.test(raw) ? Number(raw.replace(",", ".")) : Number.NaN;
  }, schema);

export const fishInputSchema = z.object({
  species: speciesSchema,
  displayName: z.string().trim().min(2).max(120),
  weightKilograms: decimalNumberSchema(3, z.number().positive().max(10000)),
  catchRegion: z.string().trim().min(2).max(120),
  grade: z.string().trim().min(1).max(40),
  startingPriceMajor: decimalNumberSchema(2, z.number().positive().max(10_000_000)),
  sellerId: uuidSchema,
  description: z.string().trim().max(500).optional().or(z.literal("")),
  imageUrl: z.string().trim().url().optional().or(z.literal("")),
});

export const bidInputSchema = z.object({
  auctionId: uuidSchema,
  bidderId: uuidSchema,
  amountCents: z.coerce.number().int().positive(),
  expectedHighestBidCents: z.coerce.number().int().nonnegative().nullable(),
});

export const auctionInputSchema = z
  .object({
    fishItemId: uuidSchema,
    adminUserId: uuidSchema,
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    minimumIncrementCents: z.coerce.number().int().positive(),
  })
  .refine((input) => input.startsAt < input.endsAt, {
    message: "Auction end time must be after the start time",
    path: ["endsAt"],
  });

export const closeAuctionInputSchema = z.object({
  auctionId: uuidSchema,
  adminUserId: uuidSchema,
});

export const withdrawAuctionInputSchema = z.object({
  auctionId: uuidSchema,
  adminUserId: uuidSchema,
  reason: optionalReasonSchema,
});

export const withdrawFishItemInputSchema = z.object({
  fishItemId: uuidSchema,
  adminUserId: uuidSchema,
  reason: optionalReasonSchema,
});

export const adminFiltersSchema = z
  .object({
    status: optionalAdminStatusSchema,
    species: optionalSpeciesSchema,
    sellerId: optionalUuidSchema,
    buyerId: optionalUuidSchema,
    fromDate: optionalDateSchema,
    toDate: optionalDateSchema,
  })
  .refine((filters) => !filters.fromDate || !filters.toDate || filters.fromDate <= filters.toDate, {
    message: "From date must be before to date",
    path: ["toDate"],
  });

export type AdminFilters = z.infer<typeof adminFiltersSchema>;
