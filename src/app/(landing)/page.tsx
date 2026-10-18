import type { Metadata } from "next";
import Link from "next/link";
import {
  BellRing,
  CalendarClock,
  Camera,
  ChevronDown,
  ClipboardList,
  Link2,
  Lock,
  MessageCircle,
  Send,
  Smartphone,
  Users,
  Wallet,
} from "lucide-react";
import { PhonePreview } from "@/components/landing/phone-preview";
import { isSearchVisible, siteUrl } from "@/lib/site-settings";

/**
 * Public landing page for signed-out visitors (owner request 2026-10-18,
 * plans L-1, L-2). Static: proxy.ts sends signed-in artisans to /bugun and the
 * admin to /admin. No signup and no contact form: accounts are opened by
 * invitation during the pilot. No third-party scripts, nothing tracked.
 */
const TITLE = "UstaPlan · Ustalar için iş ve randevu defteri";
const DESCRIPTION =
  "İşlerini, randevularını, müşterilerini ve fotoğraflarını tek yerde tut. Müşterine özel bağlantıyla iş takibi, tarih değişikliği ve iptal. Telefonundan, uygulama mağazası olmadan.";

/** Indexable only after the owner opens search visibility in /admin/site (plan L-2); hidden by default. */
export async function generateMetadata(): Promise<Metadata> {
  const visible = await isSearchVisible();
  const base = siteUrl();
  return {
    title: { absolute: TITLE },
    description: DESCRIPTION,
    ...(base ? { metadataBase: new URL(base), alternates: { canonical: "/" } } : {}),
    robots: visible ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      title: TITLE,
      description: "İşlerini ve verdiğin sözleri unutma. İş, randevu ve müşteri takibi tek yerde.",
      locale: "tr_TR",
      type: "website",
      siteName: "UstaPlan",
      ...(base ? { url: "/" } : {}),
    },
    twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  };
}

const FEATURES = [
  {
    icon: ClipboardList,
    title: "İşler ve randevular",
    text: "İşi randevusuz da kaydet, unutma. Bir işe birden fazla ziyaret ekle; durumunu tek dokunuşla güncelle.",
  },
  {
    icon: CalendarClock,
    title: "Günlük ve haftalık takvim",
    text: "Bugünkü randevuların ve takip bekleyen işler ilk ekranda. Saatler çakışırsa uyarı görürsün, karar senin.",
  },
  {
    icon: Users,
    title: "Müşteriler ve adresler",
    text: "Her müşterinin birden çok adresi olabilir. Tek dokunuşla ara, WhatsApp'tan yaz ya da haritada aç.",
  },
  {
    icon: Camera,
    title: "Fotoğraf ve sesli not",
    text: "İşin öncesini ve sonrasını fotoğrafla, aklına geleni sesli not olarak kaydet. Neyin müşteriye görüneceğini sen seçersin.",
  },
  {
    icon: Wallet,
    title: "Fiyat takibi",
    text: "Tahmini ve anlaşılan ücreti ayrı tut, değişiklik geçmişi kalsın. Müşteri yalnızca senin açtığın anlaşılan ücreti görür.",
  },
  {
    icon: BellRing,
    title: "Bildirimler",
    text: "Müşteri iptal ettiğinde ya da yeni tarih istediğinde haber al. Randevudan 1 saat önce ve her sabah kısa bir hatırlatma.",
  },
] as const;

const STEPS = [
  { icon: ClipboardList, title: "İşi kaydet", text: "Müşteriyi seç, işi yaz, istersen randevu ekle. Birkaç dokunuş yeter." },
  { icon: Send, title: "Bağlantıyı gönder", text: "Müşterine özel bağlantıyı normal WhatsApp'tan paylaş. Müşterin uygulama indirmez." },
  { icon: BellRing, title: "Takipte kal", text: "Tarih değişikliği, iptal ve yeni fotoğraflar sana bildirim olarak gelir; takvimin hep güncel." },
] as const;

const CUSTOMER_CAN = [
  "İşin durumunu ve randevu tarihini görür",
  "Uygun değilse yeni tarih ister; sen onaylar ya da başka saat önerirsin",
  "Gerekirse sebebini seçerek işi iptal eder",
  "Fotoğraf ekler, senin paylaştığın fotoğrafları görür",
] as const;

const FAQ = [
  {
    q: "Müşterimin bir uygulama indirmesi gerekiyor mu?",
    a: "Hayır. Müşterin, senin WhatsApp'tan gönderdiğin bağlantıyı telefonunun tarayıcısında açar. Hesap açması da gerekmez.",
  },
  {
    q: "Müşterim neleri görebilir?",
    a: "Yalnızca kendi işini: durum, randevu tarihi, senin paylaştığın fotoğraflar ve açarsan anlaşılan ücret. Notların, sesli notların, tahmini ücret, diğer işlerin ve takvimin görünmez. Bağlantıyı istediğin an kapatabilir ya da yenileyebilirsin.",
  },
  {
    q: "Hangi telefonlarda çalışır?",
    a: "iPhone ve Android'de tarayıcıdan çalışır. Ana ekrana ekleyince uygulama gibi açılır. iPhone'da bildirimler için iOS 16.4 veya üstü ve ana ekrana ekleme gerekir.",
  },
  {
    q: "Ücretli mi?",
    a: "Pilot süresince ücretsiz.",
  },
  {
    q: "Nasıl hesap açarım?",
    a: "Pilot aşamasında hesaplar davetle açılıyor; kayıt formu yok. Hesabın açıldıysa e-posta adresin ve sana verilen geçici şifreyle giriş yapabilir, şifreni Ayarlar'dan değiştirebilirsin.",
  },
  {
    q: "WhatsApp Business gerekiyor mu?",
    a: "Hayır. Kendi WhatsApp'ınla paylaşırsın; mesajı sen gönderirsin, otomatik mesaj atılmaz.",
  },
  {
    q: "Verilerim güvende mi?",
    a: "Her usta yalnızca kendi müşterilerini ve işlerini görür. Veriler hizmet sağlayıcılarımızın Avrupa Birliği'ndeki sunucularında saklanır, reklam veya pazarlama amacıyla paylaşılmaz. Fotoğraflardaki konum bilgisi yüklenirken silinir.",
  },
  {
    q: "İnternet olmadan çalışır mı?",
    a: "Kayıt eklemek ve güncellemek için internet bağlantısı gerekir.",
  },
] as const;

/** Structured data for search results: the app and the FAQ (data only, not a script that runs). */
function StructuredData() {
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "UstaPlan",
      description: DESCRIPTION,
      applicationCategory: "BusinessApplication",
      operatingSystem: "iOS, Android, Web",
      inLanguage: "tr",
      offers: { "@type": "Offer", price: "0", priceCurrency: "TRY", description: "Pilot süresince ücretsiz" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    },
  ];
  // "<" escaped so the JSON can never close the tag.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <StructuredData />
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4">
          <Link href="/" className="flex items-center gap-2" aria-label="UstaPlan ana sayfa">
            <span aria-hidden className="flex size-8 items-center justify-center rounded-lg bg-primary text-base font-bold text-primary-foreground">
              U
            </span>
            <span className="text-lg font-bold tracking-tight text-ink">UstaPlan</span>
          </Link>
          <nav aria-label="Sayfa içi" className="flex items-center gap-1">
            <a href="#ozellikler" className="hidden h-11 items-center rounded-xl px-3 text-sm font-medium text-muted-foreground hover:text-ink sm:flex">
              Özellikler
            </a>
            <a href="#sss" className="hidden h-11 items-center rounded-xl px-3 text-sm font-medium text-muted-foreground hover:text-ink sm:flex">
              Sık sorulanlar
            </a>
            <Link
              href="/giris"
              className="flex h-11 items-center rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-ink hover:bg-muted"
            >
              Giriş yap
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {/* Hero */}
        <section className="mx-auto grid w-full max-w-5xl items-center gap-10 px-4 pt-10 pb-14 md:grid-cols-[1.1fr_1fr] md:pt-16 md:pb-20">
          <div className="flex flex-col gap-5">
            <span className="w-fit rounded-md bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">Ustalar için dijital iş defteri</span>
            <h1 className="text-[2.1rem] leading-tight font-bold tracking-tight text-ink sm:text-5xl">İşlerini ve verdiğin sözleri unutma.</h1>
            <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
              Aldığın işler, randevular, müşteriler, fotoğraflar ve anlaşılan fiyatlar tek yerde. Müşterin, ona özel bir bağlantıyla
              işini takip eder, yeni tarih ister ya da iptal eder; sen hepsinden anında haberdar olursun.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/giris"
                className="flex h-12 items-center justify-center rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Giriş yap
              </Link>
              <a
                href="#nasil"
                className="flex h-12 items-center justify-center gap-1.5 rounded-xl px-4 text-base font-semibold text-ink hover:bg-muted"
              >
                Nasıl çalışır?
                <ChevronDown className="size-4" aria-hidden />
              </a>
            </div>
            <p className="text-sm text-muted-foreground">Pilot aşamasında hesaplar davetle açılıyor. Telefonundan çalışır, uygulama mağazası gerekmez.</p>
          </div>
          <PhonePreview />
        </section>

        {/* Features */}
        <section id="ozellikler" className="scroll-mt-20 border-t border-border bg-surface">
          <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-14 md:py-20">
            <div className="flex max-w-2xl flex-col gap-2">
              <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Bir ustanın günü için gereken her şey</h2>
              <p className="text-base text-muted-foreground">Sade ekranlar, büyük düğmeler. Sahada, tek elle kullanmak için tasarlandı.</p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-5">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="text-base font-semibold text-ink">{title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How it works */}
        <section id="nasil" className="scroll-mt-20 border-t border-border">
          <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-14 md:py-20">
            <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Nasıl çalışır?</h2>
            <ol className="grid gap-3 md:grid-cols-3">
              {STEPS.map(({ icon: Icon, title, text }, index) => (
                <li key={title} className="flex gap-4 rounded-2xl border border-border bg-surface p-5 md:flex-col">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-base font-bold text-primary-foreground">
                    {index + 1}
                  </span>
                  <div className="flex flex-col gap-1">
                    <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
                      <Icon className="size-4 text-primary" aria-hidden />
                      {title}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Customer link */}
        <section className="border-t border-border bg-surface">
          <div className="mx-auto grid max-w-5xl gap-8 px-4 py-14 md:grid-cols-2 md:py-20">
            <div className="flex flex-col gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Link2 className="size-5" aria-hidden />
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Müşterin için tek bir bağlantı</h2>
              <p className="text-base leading-relaxed text-muted-foreground">
                “Ne zaman geliyorsunuz?” telefonları azalır. Müşterin işini kendi açar; değişiklik istediğinde sana bildirim gelir.
              </p>
            </div>
            <div className="flex flex-col gap-4">
              <ul className="flex flex-col gap-2">
                {CUSTOMER_CAN.map((item) => (
                  <li key={item} className="flex gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm text-ink">
                    <MessageCircle className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="flex gap-3 rounded-xl bg-primary-soft px-4 py-3 text-sm text-ink">
                <Lock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                Müşterinin telefonu ve adresi bu sayfada görünmez. Notların, tahmini ücret ve takvimin yalnızca sende kalır.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="sss" className="scroll-mt-20 border-t border-border">
          <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-14 md:py-20">
            <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Sık sorulanlar</h2>
            <div className="flex flex-col gap-2">
              {FAQ.map(({ q, a }) => (
                <details key={q} className="group rounded-2xl border border-border bg-surface">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-base font-semibold text-ink [&::-webkit-details-marker]:hidden">
                    {q}
                    <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <p className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Closing */}
        <section className="border-t border-border bg-surface">
          <div className="mx-auto flex max-w-5xl flex-col items-start gap-4 px-4 py-14 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Smartphone className="size-5" aria-hidden />
              </span>
              <div>
                <p className="text-base font-semibold text-ink">Hesabın var mı?</p>
                <p className="text-sm text-muted-foreground">E-posta adresin ve şifrenle giriş yap.</p>
              </div>
            </div>
            <Link
              href="/giris"
              className="flex h-12 w-full items-center justify-center rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground hover:bg-primary/90 sm:w-auto"
            >
              Giriş yap
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 UstaPlan</span>
          <Link href="/gizlilik" className="flex h-11 items-center hover:text-ink">
            Kişisel verileriniz
          </Link>
        </div>
      </footer>
    </div>
  );
}
