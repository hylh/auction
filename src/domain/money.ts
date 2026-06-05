export function centsFromMajor(value: string | number): number {
  const raw = String(value).trim();
  if (!/^\d+$/.test(raw)) {
    throw new Error("Money values must be whole numbers (no decimals or cents)");
  }

  return Number(raw) * 100;
}

export function formatMoney(cents: number, currency = "NOK") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatMoneyWhole(cents: number, currency = "NOK") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
