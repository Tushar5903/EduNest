/**
 * Single shared phone normalization for the whole backend (creation, storage,
 * duplicate checks, login lookup). Strip every non-digit, keep country-code
 * digits when present: "+91 98765 43210" → "919876543210".
 */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** Normalized phones used as teacher login aliases are 10–15 digits. */
export function isPhoneLike(normalized: string): boolean {
  return /^\d{10,15}$/.test(normalized);
}
