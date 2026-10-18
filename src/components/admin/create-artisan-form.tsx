"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createArtisan } from "@/actions/admin";
import { describedBy, FormField, inputClassName } from "@/components/common/form-field";
import { TemporaryPassword } from "./temporary-password";

export function CreateArtisanForm() {
  const [state, formAction, pending] = useActionState(createArtisan, null);

  if (state?.ok) {
    return (
      <div className="flex flex-col gap-4">
        <TemporaryPassword password={state.data.password} email={state.data.email} />
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/ustalar/${state.data.userId}`}
            className="flex h-12 items-center rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Ustayı aç
          </Link>
          <Link href="/admin/ustalar" className="flex h-12 items-center rounded-xl border border-border bg-surface px-4 text-base font-semibold text-ink hover:bg-muted">
            Ustalara dön
          </Link>
        </div>
      </div>
    );
  }

  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const values = state && !state.ok ? state.values : undefined;
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormField id="name" label="Ad soyad" hint="Ustanın uygulamada ve müşteri sayfasında görünen adı." error={errors.name}>
        <input
          id="name"
          name="name"
          maxLength={80}
          required
          defaultValue={values?.name}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={describedBy("name", errors.name, "hint")}
          className={inputClassName}
        />
      </FormField>
      <FormField id="email" label="E-posta" hint="Usta bu adresle giriş yapar. E-posta gönderilmez." error={errors.email}>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={values?.email}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={describedBy("email", errors.email, "hint")}
          className={inputClassName}
        />
      </FormField>
      {state && !state.ok && !state.fieldErrors ? (
        <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-xl bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-70"
      >
        {pending ? "Oluşturuluyor…" : "Hesabı oluştur"}
      </button>
    </form>
  );
}
