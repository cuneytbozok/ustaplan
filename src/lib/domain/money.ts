// Money is numeric(12,2) TRY in the DB; shown and parsed the Turkish way.

const wholeFormatter = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
const centsFormatter = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 2 });

/** 2500 → "₺2.500", 2500.5 → "₺2.500,50" (tr-TR currency format). */
export function formatTRY(amount: number) {
  return (Number.isInteger(amount) ? wholeFormatter : centsFormatter).format(amount);
}

/**
 * Parses Turkish price input: "2.500,50", "2500,5", "2500", "₺ 1.200".
 * Returns null for empty or invalid input, negatives, or more than 2 decimals.
 */
export function parseTurkishPrice(input: string): number | null {
  const cleaned = input.replace(/[₺\s]/g, "").replace(/tl$/i, "");
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(value) && value <= 9_999_999_999.99 ? value : null;
}

const wholeInput = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
const centsInput = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Prefills a price input so parseTurkishPrice reads it back: 2500 → "2.500", 2500.5 → "2.500,50". */
export function formatPriceInput(amount: number | null) {
  if (amount === null) return "";
  return (Number.isInteger(amount) ? wholeInput : centsInput).format(amount);
}
