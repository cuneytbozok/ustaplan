import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Giriş" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div
            aria-hidden="true"
            className="flex size-14 items-center justify-center rounded-2xl bg-primary text-3xl font-bold text-primary-foreground"
          >
            U
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">UstaPlan</h1>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <LoginForm />
        </div>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Şifrenizi unuttuysanız yöneticinizle iletişime geçin.
        </p>
      </div>
    </main>
  );
}
