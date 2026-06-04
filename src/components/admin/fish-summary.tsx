import type { ReactNode } from "react";
import { formatKilograms } from "../../domain/weight";

type FishSummaryProps = {
  fish: {
    displayName: string;
    species: string;
    weightGrams: number;
  };
  detail: ReactNode;
};

export function FishSummary({ detail, fish }: FishSummaryProps) {
  return (
    <div>
      <strong>{fish.displayName}</strong>
      <div className="sub">
        {fish.species} · {formatKilograms(fish.weightGrams)} · {detail}
      </div>
    </div>
  );
}
