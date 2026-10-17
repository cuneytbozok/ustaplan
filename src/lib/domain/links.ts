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
