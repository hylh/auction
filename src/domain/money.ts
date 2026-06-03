export function centsFromMajor(value: string | number): number {
  const raw = String(value).trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new Error("Money values must use at most two decimal places");
  }

  const [whole, fraction = ""] = raw.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function formatMoney(cents: number, currency = "NOK") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
