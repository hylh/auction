export function gramsFromKilograms(value: string | number): number {
  const raw = String(value).trim().replace(",", ".");
  if (!/^\d+(\.\d{1,3})?$/.test(raw)) {
    throw new Error("Weight values must use kilograms with up to three decimals");
  }

  return Math.round(Number(raw) * 1000);
}

export function formatKilograms(grams: number) {
  return `${new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 3,
  }).format(grams / 1000)} kg`;
}
