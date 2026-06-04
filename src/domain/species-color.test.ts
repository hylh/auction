import { describe, expect, it } from "vitest";
import { FISH_SPECIES } from "./constants";
import { SPECIES_COLOR_TOKEN, speciesColorToken } from "./species-color";

describe("SPECIES_COLOR_TOKEN", () => {
  it("has an entry for every species in FISH_SPECIES", () => {
    for (const species of FISH_SPECIES) {
      expect(SPECIES_COLOR_TOKEN[species]).toMatch(/^--sp-/);
    }
  });

  it("has exactly the same species count as FISH_SPECIES", () => {
    expect(Object.keys(SPECIES_COLOR_TOKEN).length).toBe(FISH_SPECIES.length);
  });

  it("all tokens start with --sp-", () => {
    for (const token of Object.values(SPECIES_COLOR_TOKEN)) {
      expect(token).toMatch(/^--sp-[a-z]+$/);
    }
  });
});

describe("speciesColorToken", () => {
  it("returns the correct token for each species", () => {
    expect(speciesColorToken("salmon")).toBe("--sp-salmon");
    expect(speciesColorToken("cod")).toBe("--sp-cod");
    expect(speciesColorToken("tuna")).toBe("--sp-tuna");
    expect(speciesColorToken("halibut")).toBe("--sp-halibut");
    expect(speciesColorToken("mackerel")).toBe("--sp-mackerel");
    expect(speciesColorToken("trout")).toBe("--sp-trout");
    expect(speciesColorToken("herring")).toBe("--sp-herring");
  });

  it("returns --muted for an unknown species", () => {
    expect(speciesColorToken("piranha")).toBe("--muted");
    expect(speciesColorToken("")).toBe("--muted");
  });
});
