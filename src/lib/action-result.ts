/** Server Action result shape (CLAUDE.md): Turkish error messages, no success before persistence. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
