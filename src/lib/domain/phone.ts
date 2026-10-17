// Phones are stored as E.164 (DB check ^\+[1-9][0-9]{7,14}$). Input is
// usually Turkish: "0532 123 45 67", "532 123 45 67", "+90 532 …".

const E164 = /^\+[1-9]\d{7,14}$/;

/** Normalises user input to E.164, assuming Turkey for local numbers. Null if invalid. */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, "");
  let candidate: string;
  if (trimmed.startsWith("+")) candidate = `+${digits}`;
  else if (digits.startsWith("00")) candidate = `+${digits.slice(2)}`;
  else if (digits.length === 11 && digits.startsWith("0")) candidate = `+90${digits.slice(1)}`;
  else if (digits.length === 10 && digits.startsWith("5")) candidate = `+90${digits}`;
  else candidate = `+${digits}`;
  return E164.test(candidate) ? candidate : null;
}

/** "+905321234567" → "0532 123 45 67"; other countries stay E.164. */
export function formatPhone(e164: string): string {
  const match = /^\+90(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(e164);
  return match ? `0${match[1]} ${match[2]} ${match[3]} ${match[4]}` : e164;
}

/** tel: link target. */
export function telHref(e164: string) {
  return `tel:${e164}`;
}
