import "server-only";

/** Unwraps a Supabase `count: "exact", head: true` result; throws to the error boundary on failure. */
export function countOrThrow(result: { count: number | null; error: { message: string } | null }) {
  if (result.error) throw new Error(result.error.message);
  return result.count ?? 0;
}
