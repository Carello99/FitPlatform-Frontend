/**
 * ============================================================================
 *  FILE: date.utils.ts  —  DATE COME STRINGHE 'YYYY-MM-DD'
 * ============================================================================
 *  SCOPO: l'app identifica un giorno con una stringa ISO ('2026-07-22'): è ciò
 *    che sta nelle sedute, nelle richieste e nello storico, ed è confrontabile
 *    con `<` e `>` senza convertire niente.
 *
 *  PERCHÉ NON `toISOString().slice(0, 10)`: quello dà il giorno **UTC**. In
 *    Italia, tra mezzanotte e le due, restituisce ieri — e «oggi» diventa ieri
 *    proprio nelle ore in cui qualcuno chiude la giornata in palestra. Qui si
 *    legge sempre il calendario locale.
 * ============================================================================
 */

/** Il giorno di una data, in ora locale: '2026-07-22'. */
export function isoDay(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
