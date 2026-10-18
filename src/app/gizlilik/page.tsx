import type { Metadata } from "next";

export const metadata: Metadata = { title: "Kişisel verileriniz", referrer: "no-referrer" };

/**
 * KVKK notice for customers (siz tone), linked from every customer page.
 * Text: docs/setup/PRIVACY_AND_DATA_REQUESTS.md §2 (draft; legal review is
 * required before real customer data, see PROGRESS blockers).
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8 text-base leading-relaxed text-ink">
      <h1 className="text-2xl font-bold tracking-tight">Kişisel verileriniz hakkında</h1>
      <p>
        Bu sayfa, işinizi kaydeden usta tarafından UstaPlan aracılığıyla sizinle paylaşılmıştır. Adınız, telefon numaranız, adresiniz,
        işe ait bilgiler, randevu tarihleri ve bu sayfadan yüklediğiniz fotoğraflar yalnızca işinizin planlanması ve yürütülmesi
        amacıyla ustanız tarafından işlenir. Bu verilerin sorumlusu ustanızdır; UstaPlan yalnızca hizmeti sağlar.
      </p>
      <p>
        Telefon numaranız ve adresiniz bu sayfada gösterilmez. Fotoğraflarınızdaki konum bilgisi yükleme sırasında silinir. Veriler,
        hizmet sağlayıcılarımızın Avrupa Birliği&apos;ndeki sunucularında saklanır ve üçüncü kişilerle reklam veya pazarlama amacıyla
        paylaşılmaz.
      </p>
      <p>
        KVKK&apos;nın 11. maddesi kapsamındaki haklarınızı (bilgi talep etme, düzeltme, silme vb.) kullanmak için ustanızla iletişime
        geçebilirsiniz. Talebiniz en geç 30 gün içinde sonuçlandırılır.
      </p>
    </main>
  );
}
