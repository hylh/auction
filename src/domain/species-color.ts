import type { FISH_SPECIES } from "./constants";

export type Species = (typeof FISH_SPECIES)[number];

/**
 * Maps each species name to its CSS custom property token.
 * Use as: style={{ background: `var(${speciesColorToken(species)})` }}
 * or as a className fragment for the .sdot color approach.
 */
export const SPECIES_COLOR_TOKEN: Record<Species, string> = {
  salmon: "--sp-salmon",
  cod: "--sp-cod",
  tuna: "--sp-tuna",
  halibut: "--sp-halibut",
  mackerel: "--sp-mackerel",
  trout: "--sp-trout",
  herring: "--sp-herring",
};

/**
 * Return the CSS variable token for a species.
 * Falls back to "--muted" for unknown species so the UI degrades gracefully.
 */
export function speciesColorToken(species: string): string {
  return (SPECIES_COLOR_TOKEN as Record<string, string>)[species] ?? "--muted";
}
