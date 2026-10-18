# UstaPlan — MVP v1.5 · Product + UX + Architecture Specification

**Durum:** Development-ready specification, implementation has not yet been built.  
**Hedef:** 1–2 bağımsız usta ile küçük pilot; sade, hızlı, mobil öncelikli PWA.  
**Dil / para / saat:** Türkçe (tr-TR), TRY (₺), Europe/Istanbul, 24 saat.  
**Ana ilke:** Usta uygulamayı kullanır. Müşteri yalnızca kendi işine ait bağlantıyı açar. Müşteri hesabı, herkese açık signup, usta bulma, AI, ödeme veya muhasebe yok.

> **v1.4 değişiklikleri (ürün sahibi kararları, 2026-10-17).** Bu sürüm v1.3'ün üzerine aşağıdaki kararları işler; ayrıntılı teknik karşılıkları [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md) içindedir.
> 1. Resmi uygulama adı **UstaPlan** (eski çalışma adı “Usta Defteri” kullanılmaz).
> 2. Giriş ekranında yalnızca “Şifrenizi unuttuysanız yöneticinizle iletişime geçin.” yazar; yönetici iletişim bilgisi gösterilmez.
> 3. Müşteri bağlantıları yapılandırılabilir `APP_BASE_URL` ile üretilir; pilotta varsayılan `vercel.app` alt alanı kullanılır.
> 4. Barındırma: Vercel Hobby (yalnızca ticari olmayan test) + Supabase Free. Ticari kullanımdan önce uygun plana geçilir.
> 5. Müşteri sayfasından erişilen kısa Türkçe KVKK aydınlatma metni ve manuel veri silme süreci MVP kapsamındadır.
> 6. **Web Push bildirimleri MVP kapsamındadır** (§9): anlık (iptal, tarih talebi, karşı teklif kabulü) ve zamanlanmış (randevudan 1 saat önce, günlük takip hatırlatması).
> 7. Tahmini ücret hiçbir zaman müşteriye gösterilmez; müşteri yalnızca usta açarsa anlaşılan ücreti görür. Fiyat değişikliklerinin basit geçmişi tutulur.
> 8. Tamamlanan işler de yeniden açılabilir. Müşteri yalnızca sıradaki planlı randevu için tarih değişikliği isteyebilir.
> 9. Müşteri fotoğraf yüklediğinde ustaya yalnızca uygulama içi bildirim gider.
> 10. iPhone HEIC fotoğrafları desteklenir; yüklemeden önce dönüştürülür, sıkıştırılır ve EXIF/GPS bilgisi silinir.

> **v1.5 değişikliği (ürün sahibi kararı, 2026-10-18).** Yalnızca ürün sahibinin girebildiği basit bir **yönetici paneli** (`/admin`) MVP kapsamına alındı (§2.1): usta listesi, usta ekleme, geçici şifre atama, devre dışı bırakma/etkinleştirme ve üst düzey kullanım özeti. Giriş şifre + doğrulama uygulaması (TOTP) ister. Panel müşteri kişisel verisi göstermez. Diğer kapsam dışı kurallar değişmedi.
>
> **v1.5 eki (ürün sahibi, 2026-10-18).** Giriş yapmamış ziyaretçiler için `/` adresinde tek sayfalık tanıtım sayfası: hero, özellikler, nasıl çalışır, müşteri bağlantısı, SSS ve “Giriş yap”. Kayıt formu ve iletişim düğmesi yok (pilotta hesaplar davetle açılır); SSS'de “pilot süresince ücretsiz”. Yalnızca bu sayfa arama motorlarına açıktır; üçüncü taraf betik ve analitik yoktur. Giriş yapmış usta `/bugun`'e, yönetici `/admin`'e yönlendirilir.

## 1. Ürünün vaadi

“İşlerini ve verdiğin sözleri unutma.” Ustanın aldığı işleri, müşterilerini, randevularını, fotoğraflarını, sesli notlarını ve anlaşılan fiyatları tek yerde tutan dijital iş defteri. Müşteriye özel bir web bağlantısı üzerinden iş takibi, fotoğraf yükleme, tarih değişikliği talebi ve doğrudan iş iptali sağlanır.

## 2. Roller ve erişim

| Rol | Giriş | Kapsam |
| --- | --- | --- |
| Usta | Supabase Auth, e-posta/şifre | Yalnızca kendine ait müşteriler, adresler, işler, randevular, medyalar, talepler |
| Müşteri | Hesap yok; yalnızca o işe özel gizli URL | Tek bir işin sınırlı detayları ve tanımlı müşteri işlemleri |
| Yönetici (ürün sahibi) | (v1.5) `/admin` yönetici paneli: aynı giriş sayfası, ayrı yönetici hesabı, şifre + TOTP; ayrıca Supabase Dashboard ve güvenli yerel admin scriptleri | Usta hesaplarını açma, geçici şifre atama, devre dışı bırakma/etkinleştirme, üst düzey kullanım özeti, pilot yönetimi |

* Supabase public signup kapalı. Uygulamada kayıt sayfası veya giriş yapmadan usta olma yolu yok.
* Usta hesabı e-posta + geçici şifre ile yönetici tarafından oluşturulur; e-posta yönetici tarafından doğrulanmış işaretlenebilir.
* İlk girişten sonra usta **Ayarlar → Şifremi değiştir** üzerinden mevcut şifresiyle yeni şifre belirleyebilir; uygun Supabase Auth yöntemi kullanılır.
* SMTP yok; pilotta “Şifremi unuttum” işlemi **yöneticiyle iletişim** yönergesidir, sahte otomatik sıfırlama butonu değildir. Giriş ekranındaki metin: “Şifrenizi unuttuysanız yöneticinizle iletişime geçin.” (iletişim bilgisi gösterilmez). Yönetici geçici şifreyi yönetici panelinden (v1.5) veya sunucu tarafı admin scriptiyle (`auth.admin.updateUserById`) atar; şifre ustaya yönetici tarafından elden/özel olarak iletilir, otomatik e-posta yoktur.
* Admin yetkisi veya Supabase secret/service key asla istemciye taşınmaz. Admin scriptleri dağıtılan uygulamanın genel kullanıcı arayüzünde bulunmaz; yönetici paneli (v1.5) tüm işlemleri sunucuda yapar.

### 2.1 Yönetici paneli (v1.5)

* Adres `/admin`. Yalnızca `app_metadata.role = admin` işaretli, **usta profili olmayan** ayrı yönetici hesabı girebilir; ayrıca oturum TOTP ile doğrulanmış olmalıdır (AAL2). İlk girişte doğrulama uygulaması QR koduyla kaydedilir. Diğer herkes (usta, girişsiz ziyaretçi) 404 görür. Yönetici hesabı yerel scriptle oluşturulur.
* `/giris` tek giriş sayfasıdır; yönetici girişten sonra panele yönlendirilir.
* **Ustalar:** liste (ad, e-posta, durum renk + metinle, son giriş, son etkinlik, müşteri ve iş sayıları, son 30 gündeki işler, bildirimi açık cihaz sayısı) ve usta detayı. İşlemler, her biri onay ister: **Usta ekle** (e-posta + ad; geçici şifre bir kez gösterilir), **Şifre sıfırla** (yeni geçici şifre bir kez gösterilir, saklanmaz, loglanmaz), **Devre dışı bırak / Etkinleştir**. Usta silme yoktur (silme/dışa aktarma belgelenmiş manuel süreçle).
* **Devre dışı bırakma:** usta giriş yapamaz ve oturumu yenilenemez, cihazlarına push gitmez (abonelikleri silinir). Veriler değişmez; **müşteri bağlantıları çalışmaya devam eder**. Etkinleştirince her şey eski haline döner; bildirimler cihaz başına yeniden açılır.
* **Genel bakış:** bugün / bu hafta / bu ay açılan işler (önceki dönemle birlikte), son 12 haftanın haftalık iş ve yeni müşteri eğilimi (basit çubuklar + tablo), aktif usta sayısı (son 7/30 gün), toplam usta, müşteri ve durumlara göre iş sayıları, bugünkü/bu haftaki randevular, kısa sistem sağlığı (son 24 saatin push sonuçları, bekleyen push, medya sayısı ve depolama).
* **Gizlilik:** panel yalnızca usta bazında **sayılar** gösterir; müşteri adı, telefonu, adresi, notlar, fotoğraflar veya iş içeriği gösterilmez. Harici analitik servisi kullanılmaz.
* Masaüstü öncelikli, 360 px'te kullanılabilir. Arayüz Türkçe, *sen* hitabı.

## 3. Ürün bilgi mimarisi

Ustanın alt menüsü, **dört sekme:** `Bugün`, `Takvim`, `İşler`, `Müşteriler`. Sağ üst profil menüsünden `Ayarlar` ve `Çıkış`. Her ana bölümden erişilebilir belirgin `+ Yeni iş` aksiyonu. Masaüstünde ekran ortasında sınırlı genişlikte mobil uyumlu yapı; geniş ekranlarda iki sütun mümkün ama şart değil.

### Ekranlar / rotalar

| Rota | İçerik ve başlıca aksiyonlar |
| --- | --- |
| `/giris` | E-posta, şifre, göster/gizle, giriş, manuel şifre kurtarma bilgisi |
| `/bugun` | Bugünkü randevular; bekleyen tarih talepleri; planlanacak, geciken ve parça bekleyen işler; yeni iş |
| `/takvim` | Gün ve hafta görünümü, saatli randevular, müsait/dolu/çakışma durumları |
| `/isler` | Açık / tamamlanan / iptal edilen filtreleri; müşteri, telefon veya iş adıyla arama |
| `/isler/yeni` | Müşteri seç/oluştur, açıklama, opsiyonel adres/tarih/fiyat, kaydet |
| `/isler/[id]` | İş ayrıntısı, randevular, fotoğraflar, ses notları, fiyat, özel not, geçmiş, durum değiştir, paylaş |
| `/musteriler` | Arama, müşteri listesi, yeni müşteri |
| `/musteriler/[id]` | Müşteri profili, birden fazla adres, iletişim, tüm geçmiş işler ve medyaları |
| `/ayarlar` | Usta adı, işletme adı, iletişim numarası, şifre değişikliği, **Bildirimleri etkinleştir**, çıkış |
| `/bildirimler` | Uygulama içi bildirim kutusu; üst alandaki zil ikonundan ve okunmamış sayısından erişilir (alt menüye sekme eklenmez) |
| `/t/[token]` (token = `jobId.signature`) | **Hesapsız** müşteri iş sayfası; yetkilendirme özel URL imzasıyla yapılır |
| `/gizlilik` | Müşteri sayfasından bağlantı verilen kısa KVKK aydınlatma metni |

Public müşteri rotasının yeni iş oluşturma, usta profilini yönetme veya diğer işleri bulma özelliği **yoktur**.

## 4. Usta kullanım akışları

### 4.1 3 adımda iş oluşturma

1. `+ Yeni iş` → mevcut müşteriyi seç **veya** inline müşteri oluştur (ad zorunlu, telefon isteğe bağlı; telefon yoksa WhatsApp paylaşımı kullanılamaz).
2. `Yapılacak iş` kısa açıklamasını gir. İsteğe bağlı adres (mevcut adreslerinden seçilebilir), fiyat, not ve fotoğraf ekle.
3. `Randevu planla` kapalıysa **Planlanacak** olarak kaydet; açıksa tarih, başlangıç saati ve tahmini süre seç, çakışmaları inline göstererek **Planlandı** olarak kaydet.

Ana akışta gelişmiş alanları gizlenebilir `Diğer detaylar` altında tut. 44–48 px dokunma hedefleri; tek elle kullanım.

### 4.2 İş / randevu birbirinden ayrı

* `Job` uzun ömürlü ana kayıttır. `Appointment` işin belirli tarihli ziyaretidir. Bir işte sıfır, bir veya birden çok randevu olabilir.
* İş durumları: `unplanned` (Planlanacak), `scheduled` (Planlandı), `in_progress` (Devam ediyor), `waiting_material` (Parça bekleniyor), `completed` (Tamamlandı), `cancelled` (İptal edildi).
* Randevu durumları: `scheduled`, `completed`, `cancelled`, `superseded` (yeniden planlandı). Tamamlanan randevu işi otomatik tamamlamaz.
* Parça bekleyen ve planlanmamış açık işler `Bugün` ekranındaki “Takip gereken işler” alanından kaybolmaz.
* Usta iptal edilen **veya tamamlanan** işi geçmişten tekrar açabilir; yeniden açınca otomatik yeni randevu atanmaz.

### 4.3 Takvim ve çakışma

* Tahmini süre varsayılanı 60 dakika; usta değiştirebilir (15–480 dakika).
* Aynı ustanın `scheduled` statüsündeki randevularında zaman aralıkları çakışıyorsa **inline çakışma kartı** göster: mevcut işin saati ve adı, önerilen saat aralığı.
* Çakışma **yasak değil, uyarı**dır; usta yine de randevuyu kaydedebilir. Müşteri takvimi, uygun saatleri veya başka işleri asla göremez.
* Saat/tarih değiştirme `Europe/Istanbul` olarak gösterilir; DB'de `timestamptz` saklanır.

### 4.4 İş ayrıntısı

* İş başlığı, müşteri adı, telefon (ara/WhatsApp), seçilen adres (haritada aç), durum, yaklaşan randevu ve geçmiş ziyaretler.
* Anlaşılan ücret ve opsiyonel tahmini ücret; sadece usta tarafından düzenlenir, müşteriyle fiyat paylaşımı **varsayılan kapalı**. Paylaşım açılırsa müşteri **yalnızca anlaşılan ücreti** görür; tahmini ücret her zaman ustaya özeldir. Fiyat değişiklikleri iş geçmişine kaydedilir.
* Yazılı özel notlar ve sesli notlar her zaman sadece ustaya görünür.
* Fotoğraf listesinde kim yükledi bilgisi; usta kendi fotoğrafını müşteriyle paylaşabilir veya özel tutabilir.
* `WhatsApp ile paylaş` mevcut müşterinin telefonuna `wa.me` üzerinden **gönderilmeye hazır mesaj** açar; gönder butonuna ustanın basması gerekir.
* Usta bağlantıyı kapatabilir, tekrar açabilir veya imza sürümünü artırarak eski bağlantıları geçersiz kılıp yenisini paylaşabilir.

### 4.5 Müşteri yönetimi

Müşteri: ad, opsiyonel telefon, opsiyonel özel not; sıfır veya daha fazla kayıtlı adres. Adres ekleme/düzenleme sadece ustada. Müşteri ayrıntısından geçmiş işler, fiyat ve fotoğraflar listelenir. İsim ve telefon numarasıyla arama; iş başlığında ayrıca iş arama.

## 5. Müşteri sayfası — tek iş, sıfır giriş

### 5.1 Gösterilenler

* Ustanın görünen adı/işletme adı ve **ustanın** iletişim numarası.
* Yalnızca ilgili işin kısa açıklaması, durumu ve **varsa** randevusu.
* Paylaşılması seçilmiş fotoğraflar ve müşterinin bu işe yüklediği fotoğraflar.
* `show_price_to_customer=true` ise anlaşılan fiyat.
* `Ara`, `WhatsApp`, `Tarih değişikliği iste`, `İşi iptal et`, `Fotoğraf yükle / sil`.
* Sayfa altında “Kişisel verileriniz” bağlantısı (`/gizlilik`, kısa KVKK aydınlatma metni).

**ASLA GÖSTERME:** müşterinin telefon numarası veya adresi; müşterinin diğer adresleri/işleri; ustanın takvimi, diğer müşterileri, özel notları, ses kayıtları veya saklı tutulan fotoğraflar.

### 5.2 Tarih değişikliği

1. Müşteri yalnızca işin **sıradaki planlı randevusu** için tercih ettiği yeni tarih/saat girer (müsaitlik gösterilmez). Planlı randevu yoksa talep butonu gösterilmez.
2. `appointment_requests` kaydı oluşur (`pending_artisan`). Mevcut randevu aynen kalır.
3. Usta `Onayla`, `Reddet`, `Başka tarih öner` seçeneklerinden birini kullanır. Usta yeni tarih seçerken çakışma kontrolü görür.
4. Usta onaylarsa eski randevu `superseded`, yenisi `scheduled` olur. Karşı teklifte müşteri `Kabul et` veya yeniden talep oluşturur; kabulde aynı işlem uygulanır.
5. İşlemler mümkün olduğunca atomik yapılır: çift tıklama, eşzamanlı talep/iptal veya geçersiz iş durumlarında tutarsız takvim oluşmaz.
6. Aynı randevu için aynı anda yalnızca **bir açık müzakere** (`pending_artisan`/`pending_customer`) olabilir. Müşteri talebini değiştirmek istiyorsa mevcut isteği yeniler/geri çeker.

### 5.3 İşi iptal et

* Müşteri doğrudan iptal eder; usta onayı gerekmez. Önce belirgin bir son onay ekranı.
* **Zorunlu iptal sebebi:** `İhtiyacım kalmadı`, `Fiyat yüksek geldi`, `Fikrimi değiştirdim`, `Başka bir ustayla anlaştım`, `Tarih uygun değil`, `Diğer`. `Diğer` seçilirse kısa açıklama zorunlu; diğer seçeneklerde serbest ek açıklama isteğe bağlı.
* İptal, iş kaydını `cancelled` yapar, gelecekteki planlı randevuları iptal eder, açık tarih taleplerini kapatır ve ustaya uygulama içi bildirim bırakır; iş/geçmiş silinmez.
* Tamamlanmış veya önceden iptal edilmiş iş için müşteri iptal butonu artık kullanılamaz. Tekrarlanan iptal isteği güvenli/idempotent biçimde ele alınır. Usta sonradan işi yeniden açabilir.

### 5.4 Fotoğraflar

* Müşteri özel URL üzerinden bu işe ait fotoğraf ekleyebilir: kamera veya galeri; müşteri uygulama yüklemez.
* Yanlış yüklediği **müşteri kaynaklı fotoğrafları** aynı bağlantıdan silebilir. Kimlik doğrulama olmadığından bu bağlantıya sahip herkes müşteri kaynaklı fotoğrafları silebilir — MVP'de bilinçli kabul edilen risk.
* Ustanın yüklediği paylaşılan fotoğraflar müşteri tarafından silinemez.
* İş tamamlandıktan sonra da müşteri fotoğraf ekleyip silebilir; **iptal edilmiş işlerde yeni yükleme kapalıdır**. Usta istediğinde paylaşım bağlantısını kapatabilir.
* Fotoğraf başına hedef en çok 2 MB (istemcide yeniden boyutlandır ve sıkıştır, iPhone HEIC dahil JPEG'e dönüştür, EXIF/GPS bilgisini çıkar), dosya türünü sunucuda da doğrula; ses dosyaları yalnızca ustaya açıktır.
* Silinen fotoğraf yalnızca listeden saklanmaz: yetkili Storage API üzerinden dosya silinir, medya kaydı kaldırılır/soft-delete edilir. Silme yapanın kimliği doğrulanmış gibi gösterilmez.

## 6. Güvenlik modeli — basit ama bilinçli

* Müşteri oturum açmaz, SMS ve e-posta OTP yok. Bilinçli kabul edilen risk: linke sahip herhangi biri o işin müşteri işlemlerini yapabilir.
* URL örneği: `/t/<job_uuid>.<hmac_signature>`. **HMAC-SHA256**, sunucu tarafındaki güçlü `SHARE_LINK_SECRET`, `job.id`, `share_version` değerleriyle hesaplanır. İmza sabit zamanda karşılaştırılır. `share_enabled=false` geçersiz kılar. `share_version++` eski linkleri kalıcı olarak iptal eder. URL rastgele tahmin edilemeyecek biçimde tasarlanır; sır saklama tamamen sunucu tarafındadır.
* Müşteri sayfası **doğrudan anon Supabase DB sorgusu yapmaz**. Sunucu API'si her istekte imzayı doğrular, sınırlı `CustomerJobView` DTO döndürür; tüm müşteri mutasyonlarını doğrular, oran/işlem limitlerini uygular.
* `service_role` / secret anahtar sadece sunucuda; istemciye yalnızca publishable key gider. Supabase `public` şemasındaki bütün tablolar için uygun RLS politika seti. Sahiplik `owner_user_id = auth.uid()` ve birbiriyle eşleşen ilişkisel anahtarlarla uygulanır.
* Storage bucket'ları private; usta medya dosyalarına yalnızca kendi kapsamından erişir. Müşteri sunucunun kısa süreli imzaladığı URL veya kontrollü medya endpoint'i üzerinden kendi işinin paylaşılan resmini görür. (v1.4: bağlantı iptalinin anında etkili olması için müşteri tarafında her istekte imzayı doğrulayan kontrollü medya endpoint'i kullanılır.)
* Public job sayfası ve API: `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow`; harici analitik, önbellek ve üçüncü taraf embed yok. Token loglara veya istemci analitiğine gönderilmez.
* Tek job linki üzerinden işlemlere oran sınırı (örn. 10 fotoğraf yükleme/1 saat, 20 fotoğraf/iş, 10 tarih isteği/gün); basit DB tabanlı kayıt ve sunucu kontrolleri. Dosya MIME/magic bytes ve boyut kontrolü yapılır.
* Gizli müşteri/usta verileri döndüren server endpoint'lerinde Supabase JWT kullanıcı doğrulaması ve ownership kontrolü zorunlu; cookie içeriği tek başına güvenilir sayılmaz.
* Para alanları `numeric(12,2)`; tarih `timestamptz`, uygulama saat dilimi `Europe/Istanbul`.

## 7. Veri modeli — ana tablolar

SQL başlangıç şeması ayrı dosyada [`03_SCHEMA_STARTER.sql`](../architecture/03_SCHEMA_STARTER.sql).

| Tablo | Görev |
| --- | --- |
| `profiles` | Ustanın herkese açık olmayan ayarları, işletme adı, iletişim bilgileri |
| `customers` | Ustanın müşterileri |
| `customer_addresses` | Müşteriye bağlı birden çok adres |
| `jobs` | İş, durum, fiyat, not, paylaşım ayarları |
| `appointments` | İşe bağlı sıfır veya daha fazla randevu |
| `appointment_requests` | Müşteri tarih talebi ve usta karşı teklifi |
| `job_media` | Fotoğraf ve ses kayıtlarının metadata'sı, kaynağı ve görünürlüğü |
| `job_events` | İptal, tarih değişikliği, fiyat/durum değişimi işlem geçmişi |
| `notifications` | Ustanın aksiyon gerektiren bildirim kutusu |
| `push_subscriptions` | (v1.4) Usta cihazlarının Web Push abonelikleri; kullanıcı başına birden çok cihaz |

**v1.4:** Uzlaştırılmış hedef şema ve başlangıç şemasından farklar: [DATA_MODEL.md](../architecture/DATA_MODEL.md).

**Not:** SQL starter şeması tablolar ve RLS'yi kapsar. Çok satırlı iş akışları için veri bütünlüğü işlemlerini (atomic appointment acceptance, cancellation, upload/delete cleanup) agentın ayrı uygulaması ve test etmesi gerekir.

## 8. Bilgi mimarisi ve UI tasarım sistemi

**Uygulama adı:** UstaPlan. Logotype: küçük düz tipografik imza; ikon zorunlu değil.  
**Tarz:** Minimal, sakin, profesyonel; “fintech dashboard” veya kalabalık CRM görünümü **değil**.  
**Renkler:**

| Token | Hex | Kullanım |
| --- | --- | --- |
| `background` | `#F7F8F5` | Uygulama zemini |
| `surface` | `#FFFFFF` | Kart / panel |
| `ink` | `#1C2923` | Başlık ve metin |
| `muted` | `#68766E` | İkincil açıklamalar |
| `primary` | `#19745A` | Ana CTA, seçili öğeler |
| `primary-soft` | `#EAF4EF` | Seçili kart / yumuşak vurgu |
| `border` | `#E5EAE5` | İnce ayraçlar |
| `warning` | `#BA7B2C` | Çakışma / bekleyen talep |
| `danger` | `#B64B4B` | İptal / silme |

**Tipografi:** System sans stack (`-apple-system`, `BlinkMacSystemFont`, `Inter`, `Segoe UI`, `sans-serif`) Türkçe karakterlerle. Başlık 24–28 px, kart başlığı 15–17 px, gövde 14–16 px, meta 12–13 px. 8 px spacing ölçeği, 14–18 px kart radius, az gölge, çoğunlukla border, geniş nefesli boşluklar. Her ekranda yalnızca bir baskın CTA, sade ikonlar (Lucide). Durum bilgisi renk **ve metin** ile verilir. Alt navigasyon, sticky üst alan, sabit form aksiyonu, safe-area desteği.

**Ana ekran hiyerarşisi:** “Günaydın, Mehmet” değil: `Bugün` / tarih → `3 randevun var` özeti → kronolojik iş kartları → `Takip gerekenler` → tek aksiyon `+ Yeni iş`.

**İş kartı:** saat, müşteri adı, işin 1 satırlık özeti, küçük durum etiketi; detayda arama, WhatsApp, yol tarifi. Fiyat yalnızca detayda, ana ekranda gösterilmesi zorunlu değil.

**Müşteri ekranı:** üstte işin adı/durum → varsa randevu → isteğe bağlı paylaşılan ücret → fotoğraflar ve kamera → `Tarih değişikliği iste` → `İşi iptal et` (ikincil/kırmızı) → `Ara` ve `WhatsApp`. Müşteri adresi, telefonu, müsaitlik göstergesi ve takvim yok.

**Durumlar:** yükleniyor iskeleti, boş listeye anlamlı açıklama ve aksiyon, ağ yoksa hata/yeniden dene, fotoğraf yükleme ilerlemesi, silme teyidi, kaydetme başarı feedback'i, geçersiz link ekranı.

## 9. Stack ve geliştirme ilkeleri

* Next.js App Router + TypeScript + Tailwind CSS + sade bileşen katmanı (shadcn/ui uygun ancak sadeleştir; Lucide ikonları).
* Supabase Auth + PostgreSQL + Supabase Storage, `@supabase/ssr` resmi Next.js örüntüsüne uygun.
* Vercel dağıtım; pilot için Hobby teknik açıdan yeterli olabilir, **ancak Hobby'nin ticari kullanım kısıtı geçerlidir**; ticari kullanım başlamadan plan uygunluğunu çöz / Pro'ya geç. Kullanıcı küçük teknik pilot için Hobby seçiyor. (v1.4: ücretsiz olsa da ticari nitelikteki pilot da Hobby kapsamı dışında sayılabilir; ticari kullanımdan önce plan değişikliği zorunlu. Alan adı `APP_BASE_URL` ile yapılandırılır, kodda sabitlenmez.)
* Tek repo, tek Supabase projesi, pilotta ayrı staging zorunlu değil. `.env.example` ve README şart, gerçek key commitlenmez.
* Mobil PWA: manifest + ikonlar + basit service worker/offline shell; gerçek verilerin offline yazma/senkronizasyonu MVP dışı.
* Bildirimler (v1.4 ile güncellendi): **Uygulama içi bildirim kutusu, okunmamış sayısı ve bugün/gecikmiş işler** mutlaka çalışır. **Web Push MVP kapsamındadır** (Service Worker + Push API + VAPID; abonelikler Supabase'de). Desteklenen Android tarayıcıları ve ana ekrana eklenmiş iOS PWA (iOS 16.4+). Anlık push: müşteri işi iptal etti, tarih değişikliği istedi, karşı teklifi kabul etti — zamanlanmış görevlere bağlı değildir. Zamanlanmış push: randevudan 1 saat önce hatırlatma ve günlük takip hatırlatması; Supabase Cron ile tetiklenir (Vercel Hobby Cron kullanılmaz). Müşteri fotoğraf yüklemesi ve önemsiz güncellemeler yalnızca uygulama içi. Ayarlar'da “Bildirimleri etkinleştir”; iPhone kullanıcısına izin istemeden önce ana ekrana ekleme şartı anlatılır. Çoklu cihaz, kapatma, geçersiz aboneliklerin temizlenmesi ve tekrar bildirim önleme zorunludur. Push teslimi cihaz izni, bağlantı ve işletim sistemi davranışına bağlıdır; garanti edilmez ve uygulama bunu açıkça belirtir.
* Sesli not: Web MediaRecorder destek kontrolü, 60 saniye sınırı, depolama private; desteklenmeyen cihazda açıklama.
* WhatsApp Business API yok; `https://wa.me/<E164number>?text=<encoded>`; gerçek mesaj kullanıcı tarafından gönderilir.
* Kullanılan güncel Supabase/Next.js API'lerini implementasyon anında resmi dokümanlardan kontrol et, paketleri lockfile ile sabitle.

## 10. Fonksiyonel olmayan / kabul kriterleri

1. Usta sisteme kaydolamaz, yalnızca admin tarafından açılan hesabıyla giriş yapar.
2. Usta şifresini içeriden değiştirebilir, şifre unutunca otomatik mail vaat edilmez.
3. Usta A'nın tüm endpoint ve DB erişimleriyle Usta B'nin bilgilerine erişmesi engellenir (RLS dahil otomatik test).
4. Usta randevusuz iş açabilir; ana ekrandaki `Takip gerekenler` listesinden kaybolmaz.
5. Bir işin iki ziyaret/randevusu olabilir; ilk ziyareti tamamlamak işi otomatik tamamlamaz.
6. Çakışma saat aralıklarıyla hesaplanır, müşteriye gösterilmez; ustada uyarı var ama engel yok.
7. Müşteri yeni saat ister, eski randevu onaya kadar değişmez; ustanın karşı teklifini kabul edince atomik değişir.
8. Müşteri doğrudan iptal edebilir, sebep seçer, usta bildirim alır, işlem geçmişi saklanır, usta işi yeniden açabilir.
9. Müşteri yalnızca kendi bağlantısı üzerinden fotoğraf ekler ve **müşteri kaynaklı** fotoğrafları silebilir; ustanın özel medyasını göremez/silemez.
10. Müşterinin web ekranında kendi adresi, telefon numarası, diğer işleri veya ustanın takvimi yoktur.
11. Fiyat varsayılan olarak gizlidir; usta açınca müşteri görebilir, müşteri fiyatı değiştiremez.
12. Ustanın eski işleri, müşterileri, fotoğrafları, sesli notları arayüzden bulunabilir.
13. WhatsApp paylaşımı normal kişisel WhatsApp ile çalışır; Business hesabı ve ücretli API gerekmez.
14. İptal, tarih önerisi, fotoğraf silme ve bağlantı iptali/rotasyonu tekrar denemelerinde tutarlı ve güvenli sonuç verir.
15. Temel ekranlar 360 px genişliğinde ve iOS Safari / Android Chrome üzerinde düzgün çalışır.
16. `npm run lint`, `npm run typecheck`, `npm run build` ve kritik akışların testleri geçer.
17. Kullanıcıların gerçek adları, telefonları ve açık adresleri sahte seed data dışında repo/test loglarına yazılmaz.
18. (v1.4) Bildirimleri etkinleştiren usta; müşteri iptali, tarih talebi ve karşı teklif kabulünde anlık push; randevudan 1 saat önce ve günlük takip için zamanlanmış push alır. Uygulama kapalıyken de fiziksel Android ve ana ekrana eklenmiş iOS cihazda doğrulanır. Aynı olay için tekrar bildirim gönderilmez.
19. (v1.4) Müşteri sayfasından KVKK aydınlatma metnine ulaşılır; veri silme talepleri belgelenmiş manuel süreçle karşılanır.
20. (v1.5) `/admin` yalnızca yönetici rolü ve TOTP ile doğrulanmış oturumla açılır; usta ve girişsiz ziyaretçi 404 alır ve yönetici işlemlerini çağıramaz. Devre dışı bırakılan usta giriş yapamaz ve push almaz; müşteri bağlantıları çalışır. Panel müşteri kişisel verisi göstermez.

## 11. Kesin kapsam dışı

Usta arama/pazaryeri, ödeme, fatura, tahsilat, stok, malzeme satın alma, çoklu personel yönetimi, müşteri üyeliği/uygulaması, müşterinin yeni iş açması, AI/transkripsiyon, WhatsApp Business API/otomatik WhatsApp mesajları, harita üzerinden otomatik rota, gelişmiş istatistikler ve ustaya yönelik analitik/dashboard (v1.5: yalnızca §2.1'deki basit yönetici özeti kapsamda), birden fazla yönetici veya yönetici rolleri, ücretsiz self-signup, zorunlu SMS/e-posta doğrulaması.

## 12. Kodlama ajanına teslim koşulları

Ajan uygulamayı repo içinde gerçekten oluşturmalı; sırf plan veya mockup üretip bırakmamalı. Kaynak kodu, SQL migration, README, env örneği, local run komutları, testler, deployment adımları ve admin provision/reset scriptlerini teslim etmeli. Supabase ve Vercel hesaplarına erişemiyorsa çalıştırılabilen lokal uygulamayı oluşturup **gerçek dış kaynak entegrasyonlarının test edilmediğini açıkça söylemeli**, sahte başarı raporu vermemeli.
