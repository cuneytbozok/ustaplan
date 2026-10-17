"use client";

import { useActionState } from "react";
import { updateProfile, type ProfileFormValues } from "@/actions/settings";
import { describedBy, FormField, inputClassName } from "@/components/common/form-field";
import { FormStatus } from "@/components/common/form-status";
import { formatPhone } from "@/lib/domain/phone";

export function ProfileForm({ initial }: { initial: ProfileFormValues }) {
  const [state, formAction, pending] = useActionState(updateProfile, null);
  const values = state?.values ?? initial;
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};
  // Re-mount inputs with the server's values after each save.
  const key = JSON.stringify(values);

  const phoneHint = "Müşterilerin bu numarayı görür.";
  const nameHint = "Müşteri de görür.";

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormField id="displayName" label="Adın" hint={nameHint} error={errors.displayName}>
        <input
          key={`n-${key}`}
          id="displayName"
          name="displayName"
          defaultValue={values.displayName}
          autoComplete="name"
          required
          maxLength={80}
          aria-invalid={Boolean(errors.displayName)}
          aria-describedby={describedBy("displayName", errors.displayName, nameHint)}
          className={inputClassName}
        />
      </FormField>
      <FormField id="businessName" label="İşletme adı (isteğe bağlı)" hint={nameHint} error={errors.businessName}>
        <input
          key={`b-${key}`}
          id="businessName"
          name="businessName"
          defaultValue={values.businessName}
          autoComplete="organization"
          maxLength={120}
          aria-invalid={Boolean(errors.businessName)}
          aria-describedby={describedBy("businessName", errors.businessName, nameHint)}
          className={inputClassName}
        />
      </FormField>
      <FormField id="contactPhone" label="İletişim numarası (isteğe bağlı)" hint={phoneHint} error={errors.contactPhone}>
        <input
          key={`p-${key}`}
          id="contactPhone"
          name="contactPhone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0532 123 45 67"
          defaultValue={values.contactPhone ? formatPhone(values.contactPhone) : ""}
          aria-invalid={Boolean(errors.contactPhone)}
          aria-describedby={describedBy("contactPhone", errors.contactPhone, phoneHint)}
          className={inputClassName}
        />
      </FormField>

      <FormStatus state={state} success="Bilgilerin kaydedildi." />

      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-xl bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-70"
      >
        {pending ? "Kaydediliyor…" : "Bilgileri kaydet"}
      </button>
    </form>
  );
}
