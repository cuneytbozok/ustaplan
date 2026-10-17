import { cn } from "@/lib/utils";

export const inputClassName =
  "h-12 w-full rounded-xl border border-border bg-surface px-3 text-base text-ink outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-danger";

/** Label + control + hint/error, wired with aria-describedby. */
export function FormField({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className={cn("text-xs text-muted-foreground")}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function describedBy(id: string, error?: string, hint?: string) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}
