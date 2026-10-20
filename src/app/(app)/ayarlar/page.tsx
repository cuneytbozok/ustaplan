import type { Metadata } from "next";
import { Suspense } from "react";
import { LogOut } from "lucide-react";
import { LogoutForm } from "@/components/pwa/logout-form";
import { PageHeader } from "@/components/common/page-header";
import { ListSkeleton } from "@/components/common/skeleton";
import { InstallGuide } from "@/components/pwa/install-guide";
import { PushSettings } from "@/components/pwa/push-settings";
import { PasswordForm } from "@/components/settings/password-form";
import { ProfileForm } from "@/components/settings/profile-form";
import { getCurrentArtisan } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ayarlar" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader backHref="/bugun" title="Ayarlar" />

      <Section title="Profil">
        <Suspense fallback={<ListSkeleton rows={1} />}>
          <Profile />
        </Suspense>
      </Section>

      <Section title="Şifre">
        <PasswordForm />
        <p className="mt-3 text-xs text-muted-foreground">Şifreni unutursan yöneticinle iletişime geç.</p>
      </Section>

      <Section title="Bildirimler">
        <PushSettings />
      </Section>

      <Section title="Uygulamayı ana ekrana ekle">
        <InstallGuide />
      </Section>

      <LogoutForm className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-medium text-danger hover:bg-danger/10">
          <LogOut className="size-5" aria-hidden />
          Çıkış yap
      </LogoutForm>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="mb-4 text-base font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

async function Profile() {
  const artisan = await getCurrentArtisan();
  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("display_name, business_name, contact_phone")
    .eq("id", artisan.id)
    .single();
  if (error || !profile) throw new Error(error?.message ?? "Profil bulunamadı.");

  return (
    <ProfileForm
      initial={{
        displayName: profile.display_name,
        businessName: profile.business_name ?? "",
        contactPhone: profile.contact_phone ?? "",
      }}
    />
  );
}
