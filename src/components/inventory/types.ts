import type { FISH_SPECIES } from "../../domain/constants";

export type InventoryFormState = {
  species: (typeof FISH_SPECIES)[number];
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

export type FieldErrors = Partial<Record<keyof InventoryFormState, string>>;

export type SetField = <Key extends keyof InventoryFormState>(
  field: Key,
  value: InventoryFormState[Key],
) => void;
