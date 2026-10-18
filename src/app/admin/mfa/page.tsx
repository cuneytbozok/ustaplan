import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { signOut } from "@/actions/auth";
import { TotpEnroll, TotpVerify } from "@/components/admin/totp-forms";
import { ListSkeleton } from "@/components/common/skeleton";
import { ADMIN_HOME, getAdminGate } from "@/lib/admin/auth";

export const metadata: Metadata = { title: "Doğrulama" };

export default function AdminMfaPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div
            aria-hidden="true"
            className="flex size-14 items-center justify-center rounded-2xl bg-primary text-3xl font-bold text-primary-foreground"
          >
            U
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">UstaPlan Yönetim</h1>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5">
          <Suspense fallback={<ListSkeleton rows={1} />}>
            <MfaStep />
          </Suspense>
        </div>
        <form action={signOut} className="mt-4 flex justify-center">
          <button type="submit" className="h-11 rounded-xl px-4 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-ink">
            Çıkış yap
          </button>
        </form>
      </div>
    </main>
  );
}

async function MfaStep() {
  const gate = await getAdminGate();
  if (gate.kind === "none") notFound();
  if (gate.kind === "ok") redirect(ADMIN_HOME);
  return gate.kind === "mfa-enroll" ? <TotpEnroll /> : <TotpVerify />;
}
