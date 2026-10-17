"use client";

import { useActionState } from "react";
import type { CustomerFormState, CustomerFormValues } from "@/actions/customers";
import { describedBy, FormField, inputClassName } from "@/components/common/form-field";
import { FormStatus } from "@/components/common/form-status";
import { formatPhone } from "@/lib/domain/phone";
import { cn } from "@/lib/utils";

type Action = (previous: CustomerFormState, formData: FormData) => Promise<CustomerFormState>;

/** Create/edit form. Success navigates to the customer page, so only errors render here. */
export function CustomerForm({ action, initial, submitLabel }: { action: Action; initial?: CustomerFormValues; submitLabel: string }) {
  const [state, formAction, pending] = useActionState(action, null);
  const values = state?.values ?? initial ?? { name: "", phone: "", privateNote: "" };
  const errors = state?.fieldErrors ?? {};
  const key = JSON.stringify(values);
  const noteHint = "Sadece sen görürsün.";
  const phoneHint = "Ara ve WhatsApp düğmeleri bu numarayı kullanır.";

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormField id="name" label="Ad soyad" error={errors.name}>
        <input
          key={`n-${key}`}
          id="name"
          name="name"
          defaultValue={values.name}
          autoComplete="off"
          autoCapitalize="words"
          required
          maxLength={160}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={describedBy("name", errors.name)}
          className={inputClassName}
        />
      </FormField>
      <FormField id="phone" label="Telefon (isteğe bağlı)" hint={phoneHint} error={errors.phone}>
        <input
          key={`p-${key}`}
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="0532 123 45 67"
          defaultValue={values.phone.startsWith("+") ? formatPhone(values.phone) : values.phone}
          aria-invalid={Boolean(errors.phone)}
          aria-describedby={describedBy("phone", errors.phone, phoneHint)}
          className={inputClassName}
        />
      </FormField>
      <FormField id="privateNote" label="Özel not (isteğe bağlı)" hint={noteHint} error={errors.privateNote}>
        <textarea
          key={`t-${key}`}
          id="privateNote"
          name="privateNote"
          rows={3}
          maxLength={2000}
          defaultValue={values.privateNote}
          aria-invalid={Boolean(errors.privateNote)}
          aria-describedby={describedBy("privateNote", errors.privateNote, noteHint)}
          className={cn(inputClassName, "h-auto py-2.5")}
        />
      </FormField>

      {state ? <FormStatus state={state} success="" /> : null}

      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-xl bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-70"
      >
        {pending ? "Kaydediliyor…" : submitLabel}
      </button>
    </form>
  );
}
