import { Suspense } from "react";
import { BottomNav, BottomNavBar } from "@/components/shell/bottom-nav";
import { AppHeader } from "@/components/shell/app-header";
import { NavigationMarker } from "@/components/shell/navigation-marker";
import { NewJobFab } from "@/components/shell/new-job-fab";
import { AutoRefresh } from "@/components/common/auto-refresh";
import { ListSkeleton } from "@/components/common/skeleton";
import { PwaSetup } from "@/components/pwa/pwa-setup";
import { getCurrentArtisan } from "@/lib/auth";

/**
 * Artisan shell + guard. The session is verified on the server inside a
 * Suspense boundary (Cache Components); page content renders only after it
 * passes. proxy.ts already redirects anonymous visitors optimistically.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 pt-5 pb-[calc(9rem+env(safe-area-inset-bottom))]">
        <Suspense fallback={<ListSkeleton />}>
          <AuthGate>{children}</AuthGate>
        </Suspense>
      </main>
      <Suspense fallback={null}>
        <NewJobFab />
        <NavigationMarker />
      </Suspense>
      <AutoRefresh />
      <PwaSetup />
      <Suspense fallback={<BottomNavBar pathname={null} />}>
        <BottomNav />
      </Suspense>
    </div>
  );
}

async function AuthGate({ children }: { children: React.ReactNode }) {
  await getCurrentArtisan();
  return children;
}
