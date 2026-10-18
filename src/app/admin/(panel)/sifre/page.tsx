import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { PasswordForm } from "@/components/settings/password-form";

export const metadata: Metadata = { title: "Şifre" };

/** The admin's own password (the shared Ayarlar form and action; the layout gates the page). */
export default function AdminPasswordPage() {
  return (
    <div className="flex w-full max-w-lg flex-col gap-5">
      <PageHeader title="Şifreni değiştir" subtitle="Giriş için ayrıca doğrulama uygulamasındaki kod istenir." />
      <div className="rounded-2xl border border-border bg-surface p-5">
        <PasswordForm />
      </div>
    </div>
  );
}
