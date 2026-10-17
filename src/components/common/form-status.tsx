import { CheckCircle2 } from "lucide-react";

/** Result line under a form: error, or success only after the server confirmed the write. */
export function FormStatus({ state, success }: { state: { ok: boolean; error?: string } | null; success: string }) {
  if (!state) return null;
  if (!state.ok) {
    return (
      <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger">
        {state.error}
      </p>
    );
  }
  return (
    <p role="status" className="flex items-center gap-2 rounded-xl bg-primary-soft px-3 py-2.5 text-sm text-primary">
      <CheckCircle2 className="size-4" aria-hidden />
      {success}
    </p>
  );
}
