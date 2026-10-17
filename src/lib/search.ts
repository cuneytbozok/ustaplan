import { phoneSearchDigits } from "@/lib/domain/phone";
import { foldTr } from "@/lib/domain/search-fold";

/** Reads ?q= from page searchParams: trimmed, capped at 100 characters. */
export function readQuery(q: string | string[] | undefined) {
  return (typeof q === "string" ? q : "").trim().slice(0, 100);
}

/**
 * ILIKE pattern for a generated search_key column (`fold_tr(...)`): phone-like
 * queries match the stored digits, everything else is Turkish-folded.
 * LIKE wildcards in the input are escaped so they match literally.
 */
export function searchKeyPattern(query: string) {
  const term = phoneSearchDigits(query) ?? foldTr(query);
  return `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
