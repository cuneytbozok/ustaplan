"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { signIn } from "@/actions/auth";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, null);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-ink">
          E-posta
        </label>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={state?.email}
          key={state?.email}
          className="h-12 rounded-xl border border-border bg-surface px-3 text-base text-ink outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-ink">
          Şifre
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            className="h-12 w-full rounded-xl border border-border bg-surface pr-12 pl-3 text-base text-ink outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-muted-foreground hover:text-ink focus-visible:text-ink focus-visible:outline-none"
          >
            {showPassword ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
          </button>
        </div>
      </div>

      {state?.error ? (
        <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 h-12 rounded-xl bg-primary text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-70"
      >
        {pending ? "Giriş yapılıyor…" : "Giriş yap"}
      </button>
    </form>
  );
}
