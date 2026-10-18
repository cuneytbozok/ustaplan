// Deep links that hand off to other apps. Nothing is sent automatically:
// WhatsApp opens a ready message, the artisan presses send.

/** wa.me link for an E.164 number, optionally with a prepared message. */
export function whatsappHref(e164: string, text?: string) {
  const base = `https://wa.me/${e164.replace(/\D/g, "")}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/** Map search for a free-text address; opens Google Maps (app or web) on iOS and Android. */
export function mapHref(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/** Ready WhatsApp text for the customer link (siz tone; nothing is sent automatically). */
export function shareMessage({ customerName, jobTitle, url, artisanName }: { customerName: string; jobTitle: string; url: string; artisanName: string }) {
  const firstName = customerName.trim().split(/\s+/)[0];
  return `Merhaba ${firstName}, "${jobTitle}" işinizin durumunu ve randevu bilgisini bu bağlantıdan görebilirsiniz: ${url}\n\n${artisanName}`;
}
