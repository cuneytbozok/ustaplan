"use client";

import { useActionState, useEffect } from "react";
import type { AddressFormState, AddressFormValues } from "@/actions/customers";
import { describedBy, FormField, inputClassName } from "@/components/common/form-field";
import { cn } from "@/lib/utils";

type Action = (previous: AddressFormState, formData: FormData) => Promise<AddressFormState>;

export function AddressForm({
  action,
  initial,
  idPrefix,
  submitLabel,
  onDone,
  onCancel,
}: {
  action: Action;
  initial?: AddressFormValues;
  idPrefix: string;
  submitLabel: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const values = state && !state.ok ? state.values : initial ?? { label: "", addressText: "" };
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};
  const key = JSON.stringify(values);

  // Close only after the server confirmed the write.
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  const labelId = `${idPrefix}-label`;
  const textId = `${idPrefix}-text`;
  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      <FormField id={labelId} label="Etiket (isteğe bağlı)" error={errors.label}>
        <input
          key={`l-${key}`}
          id={labelId}
          name="label"
          placeholder="Ev, İş…"
          maxLength={40}
          defaultValue={values.label}
          aria-invalid={Boolean(errors.label)}
          aria-describedby={describedBy(labelId, errors.label)}
          className={inputClassName}
        />
      </FormField>
      <FormField id={textId} label="Adres" error={errors.addressText}>
        <textarea
          key={`t-${key}`}
          id={textId}
          name="addressText"
          rows={3}
          required
          maxLength={500}
          autoComplete="street-address"
          defaultValue={values.addressText}
          aria-invalid={Boolean(errors.addressText)}
          aria-describedby={describedBy(textId, errors.addressText)}
          className={cn(inputClassName, "h-auto py-2.5")}
        />
      </FormField>
      {state && !state.ok && !state.fieldErrors ? (
        <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-11 rounded-xl border border-border bg-surface text-sm font-medium text-ink hover:bg-muted"
        >
          Vazgeç
        </button>
        <button
          type="submit"
          disabled={pending}
          className="h-11 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-70"
        >
          {pending ? "Kaydediliyor…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
