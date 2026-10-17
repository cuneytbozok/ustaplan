// Mirrors the SQL function public.fold_tr (migration `core`), so a query folded
// here matches the generated search_key columns.
const MAP: Record<string, string> = {
  İ: "i", I: "i", ı: "i", Ç: "c", ç: "c", Ğ: "g", ğ: "g", Ö: "o", ö: "o", Ş: "s", ş: "s", Ü: "u", ü: "u",
};

export function foldTr(input: string) {
  return input.replace(/[İIıÇçĞğÖöŞşÜü]/g, (char) => MAP[char]).toLowerCase();
}
