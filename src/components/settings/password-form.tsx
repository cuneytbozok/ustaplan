"use client";

import { useActionState } from "react";
import { changePassword } from "@/actions/settings";
import { describedBy, FormField, inputClassName } from "@/components/common/form-field";
import { FormStatus } from "@/components/common/form-status";

const FIELDS = [
  { name: "currentPassword", label: "Mevcut şifre", autoComplete: "current-password" },
  { name: "newPassword", label: "Yeni şifre", autoComplete: "new-password", hint: "En az 8 karakter." },
  { name: "confirmPassword", label: "Yeni şifre (tekrar)", autoComplete: "new-password" },
] as const;

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, null);
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};

  return (
    // React resets the fields after every submit, so passwords never linger.
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {FIELDS.map((field) => {
        const hint = "hint" in field ? field.hint : undefined;
        return (
          <FormField key={field.name} id={field.name} label={field.label} hint={hint} error={errors[field.name]}>
            <input
              id={field.name}
              name={field.name}
              type="password"
              autoComplete={field.autoComplete}
              required
              aria-invalid={Boolean(errors[field.name])}
              aria-describedby={describedBy(field.name, errors[field.name], hint)}
              className={inputClassName}
            />
          </FormField>
        );
      })}

      <FormStatus state={state} success="Şifren değiştirildi." />

      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-xl border border-border bg-surface text-base font-semibold text-ink hover:bg-muted disabled:opacity-70"
      >
        {pending ? "Değiştiriliyor…" : "Şifremi değiştir"}
      </button>
    </form>
  );
}
