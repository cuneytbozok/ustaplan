import { Suspense } from "react";
import { getCurrentArtisan } from "@/lib/auth";

/**
 * Guard for every artisan route. The session is verified on the server inside
 * a Suspense boundary (required by Cache Components); nothing below renders
 * until it passes. proxy.ts already redirects anonymous visitors optimistically.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<AppLoading />}>
      <AuthGate>{children}</AuthGate>
    </Suspense>
  );
}

async function AuthGate({ children }: { children: React.ReactNode }) {
  await getCurrentArtisan();
  return children;
}

function AppLoading() {
  return (
    <div className="flex flex-1 items-center justify-center" aria-busy="true">
      <span className="sr-only">Yükleniyor…</span>
      <div className="size-8 animate-pulse rounded-xl bg-primary-soft" aria-hidden />
    </div>
  );
}
