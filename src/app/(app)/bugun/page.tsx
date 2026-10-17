import type { Metadata } from "next";
import { Suspense } from "react";
import { LogOut } from "lucide-react";
import { signOut } from "@/actions/auth";
import { getCurrentArtisan } from "@/lib/auth";

export const metadata: Metadata = { title: "Bugün" };

// Minimal landing page for M1.3; the app shell and the real Bugün screen
// arrive in M1.4 and later tasks.
export default function TodayPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between gap-3">
        <span className="text-lg font-bold tracking-tight text-ink">UstaPlan</span>
        <form action={signOut}>
          <button
            type="submit"
            className="flex h-11 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-ink hover:bg-muted"
          >
            <LogOut className="size-4" aria-hidden />
            Çıkış yap
          </button>
        </form>
      </header>
      <Suspense fallback={<GreetingSkeleton />}>
        <Greeting />
      </Suspense>
    </main>
  );
}

async function Greeting() {
  const artisan = await getCurrentArtisan();
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h1 className="text-xl font-semibold text-ink">Merhaba, {artisan.displayName}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{artisan.email}</p>
    </section>
  );
}

function GreetingSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5" aria-busy="true">
      <div className="h-6 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="mt-2 h-4 w-36 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
