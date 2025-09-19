// Panamá no usa DST y está en UTC-5 estable.
const PANAMA_OFFSET_MIN = -5 * 60;

/** Convierte "YYYY-MM-DD" + "HH:MM" a Date con offset -05:00 (Panamá). */
export function dateAtPanama(dateISO: string, timeHHMM: string): Date {
  // Creamos un Date en UTC aplicando el offset inverso.
  const [y, m, d] = dateISO.split("-").map(Number);
  const [hh, mm] = timeHHMM.split(":").map(Number);
  // Construimos como si fuera UTC, luego ajustamos minutos al offset de Panamá.
  const utc = new Date(Date.UTC(y, m - 1, d, hh, mm, 0, 0));
  // utc.getTimezoneOffset() es del entorno; ignoramos y aplicamos el offset de Panamá:
  const adjusted = new Date(utc.getTime() - PANAMA_OFFSET_MIN * 60 * 1000);
  return adjusted;
}

/** Devuelve "YYYY-MM-DD" local Panamá para un Date (aprox). */
export function toPanamaDateString(dt: Date): string {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Formatea monto en USD estilo Panamá. */
export function formatUSD(cents: number): string {
  return new Intl.NumberFormat("es-PA", { style: "currency", currency: "USD" }).format(cents / 100);
}
