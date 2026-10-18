import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Yönetim", template: "%s · UstaPlan Yönetim" },
  robots: { index: false, follow: false },
};

/** Owner-only admin panel (plan §4.1). Every page and action checks access itself. */
export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return <div className="flex min-h-full flex-1 flex-col">{children}</div>;
}
