import { Suspense } from "react";
import { AdminHeader, AdminNav, AdminNavBar } from "@/components/admin/admin-header";
import { ListSkeleton } from "@/components/common/skeleton";
import { requireAdmin } from "@/lib/admin/auth";

/**
 * Admin shell + guard: the gate runs on the server inside Suspense (Cache
 * Components) before any panel content renders; non-admins get a 404.
 */
export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdminHeader>
        <Suspense fallback={<AdminNavBar pathname={null} />}>
          <AdminNav />
        </Suspense>
      </AdminHeader>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pt-6 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <Suspense fallback={<ListSkeleton />}>
          <AdminGate>{children}</AdminGate>
        </Suspense>
      </main>
    </>
  );
}

async function AdminGate({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}
