import { z } from "zod";
import { FISH_SPECIES } from "./constants";

export const uuidSchema = z.string().uuid();
export const speciesSchema = z.enum(FISH_SPECIES);

export const fishInputSchema = z.object({
  species: speciesSchema,
  displayName: z.string().trim().min(2).max(120),
  weightKilograms: z.coerce.number().positive().max(10000),
  catchRegion: z.string().trim().min(2).max(120),
  grade: z.string().trim().min(1).max(40),
  startingPriceMajor: z.coerce.number().positive().max(10_000_000),
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

export const closeAuctionInputSchema = z.object({
  auctionId: uuidSchema,
  adminUserId: uuidSchema,
});
