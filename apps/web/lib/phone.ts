// apps/web/lib/phone.ts
export function normalizePA(phone: string): string | null {
  if (!phone) return null;
  const only = phone.replace(/[^\d+]/g, '');
  if (only.startsWith('+')) return `whatsapp:${only}`;
  // Panamá: +507
  if (only.length === 8) return `whatsapp:+507${only}`;
  if (only.length === 11 && only.startsWith('507')) return `whatsapp:+${only}`;
  return `whatsapp:+${only}`;
}
