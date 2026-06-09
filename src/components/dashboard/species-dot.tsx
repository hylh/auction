import { speciesColorToken } from "../../domain/species-color";

export function SpeciesDot({ species }: { species: string }) {
  return (
    <span
      className="sdot"
      style={{ background: `var(${speciesColorToken(species)})` }}
      aria-hidden="true"
    />
  );
}
