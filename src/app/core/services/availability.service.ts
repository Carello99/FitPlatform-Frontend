import { Injectable, computed, signal } from '@angular/core';

/** Fascia oraria prenotabile. */
export interface TimeRange { start: string; end: string; }

/** Disponibilità di un giorno della settimana (più fasce). */
export interface DayAvailability { label: string; enabled: boolean; ranges: TimeRange[]; }

/** Eccezione su una data specifica (chiusura o orari diversi dalla regola). */
export interface AvailabilityException { id: string; date: string; closed: boolean; ranges: TimeRange[]; note?: string; }

const toMin = (hhmm: string): number => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const fromMin = (t: number): string => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;

/**
 * ============================================================================
 *  AVAILABILITY SERVICE — disponibilità del PT (avanzata)
 * ============================================================================
 *
 * Modella con precisione quando il PT accetta sessioni, così l'app cliente può
 * auto-prenotarsi solo dove è davvero libero:
 *   - PIÙ FASCE per giorno (es. mattina + pomeriggio con pausa pranzo);
 *   - DURATA slot + BUFFER di recupero tra una sessione e l'altra;
 *   - ECCEZIONI per data (ferie/chiusure o orari speciali) che scavalcano la
 *     regola settimanale;
 *   - (stub) sincronizzazione calendario esterno.
 *
 * Da qui si ricava la CAPACITÀ (slot prenotabili) per data e per mese.
 * Indice giorni: 0=Lunedì … 6=Domenica.
 * ============================================================================
 */
@Injectable({ providedIn: 'root' })
export class AvailabilityService {
  readonly slotMinutes = signal(60);
  readonly bufferMinutes = signal(10);
  readonly gcalConnected = signal(false);

  private readonly _week = signal<DayAvailability[]>([
    { label: 'Lunedì', enabled: true, ranges: [{ start: '08:00', end: '13:00' }, { start: '15:00', end: '20:00' }] },
    { label: 'Martedì', enabled: true, ranges: [{ start: '08:00', end: '13:00' }, { start: '15:00', end: '20:00' }] },
    { label: 'Mercoledì', enabled: true, ranges: [{ start: '08:00', end: '13:00' }, { start: '15:00', end: '20:00' }] },
    { label: 'Giovedì', enabled: true, ranges: [{ start: '08:00', end: '13:00' }, { start: '15:00', end: '20:00' }] },
    { label: 'Venerdì', enabled: true, ranges: [{ start: '08:00', end: '13:00' }, { start: '15:00', end: '19:00' }] },
    { label: 'Sabato', enabled: true, ranges: [{ start: '09:00', end: '13:00' }] },
    { label: 'Domenica', enabled: false, ranges: [] },
  ]);
  readonly week = this._week.asReadonly();

  private readonly _exceptions = signal<AvailabilityException[]>([]);
  readonly exceptions = this._exceptions.asReadonly();

  /** Slot totali in una settimana tipo (regola, senza eccezioni). */
  readonly weeklySlots = computed(() =>
    this._week().reduce((acc, d) => acc + (d.enabled ? this.slotsInRanges(d.ranges) : 0), 0),
  );

  // --- Editor giorni ---
  toggleDay(i: number): void { this._week.update((w) => w.map((d, k) => (k === i ? { ...d, enabled: !d.enabled } : d))); }
  addRange(i: number): void {
    this._week.update((w) => w.map((d, k) => (k === i ? { ...d, ranges: [...d.ranges, { start: '09:00', end: '12:00' }] } : d)));
  }
  removeRange(i: number, idx: number): void {
    this._week.update((w) => w.map((d, k) => (k === i ? { ...d, ranges: d.ranges.filter((_, j) => j !== idx) } : d)));
  }
  setStart(i: number, idx: number, v: string): void {
    this._week.update((w) => w.map((d, k) => (k === i ? { ...d, ranges: d.ranges.map((r, j) => (j === idx ? { ...r, start: v } : r)) } : d)));
  }
  setEnd(i: number, idx: number, v: string): void {
    this._week.update((w) => w.map((d, k) => (k === i ? { ...d, ranges: d.ranges.map((r, j) => (j === idx ? { ...r, end: v } : r)) } : d)));
  }

  setSlotMinutes(v: number): void { this.slotMinutes.set(v); }
  setBufferMinutes(v: number): void { this.bufferMinutes.set(v); }
  toggleGcal(): void { this.gcalConnected.update((v) => !v); }

  // --- Eccezioni ---
  addException(date: string, closed: boolean): void {
    if (!date || this._exceptions().some((e) => e.date === date)) return;
    this._exceptions.update((list) => [...list, { id: date, date, closed, ranges: [], note: closed ? 'Chiuso' : 'Orario speciale' }].sort((a, b) => a.date.localeCompare(b.date)));
  }
  removeException(id: string): void { this._exceptions.update((list) => list.filter((e) => e.id !== id)); }

  // --- Calcolo capacità ---
  private slotsInRanges(ranges: TimeRange[]): number {
    const step = this.slotMinutes() + this.bufferMinutes();
    return ranges.reduce((acc, r) => {
      const m = toMin(r.end) - toMin(r.start);
      return acc + (m > 0 ? Math.max(0, Math.floor((m + this.bufferMinutes()) / step)) : 0);
    }, 0);
  }

  /** Fasce EFFETTIVE per una data (eccezione se presente, altrimenti la regola). */
  effectiveRanges(iso: string): TimeRange[] {
    const ex = this._exceptions().find((e) => e.date === iso);
    if (ex) return ex.closed ? [] : ex.ranges;
    const day = this._week()[(new Date(iso + 'T00:00:00').getDay() + 6) % 7];
    return day.enabled ? day.ranges : [];
  }

  /** Orari di inizio degli slot prenotabili in una data (rispetta durata+buffer). */
  slotTimesForDate(iso: string): string[] {
    const slot = this.slotMinutes();
    const step = slot + this.bufferMinutes();
    const out: string[] = [];
    for (const r of this.effectiveRanges(iso)) {
      const s = toMin(r.start), e = toMin(r.end);
      for (let t = s; t + slot <= e; t += step) out.push(fromMin(t));
    }
    return out;
  }

  /** Capacità (slot) di un mese. */
  monthlyCapacity(year: number, month: number): number {
    const days = new Date(year, month + 1, 0).getDate();
    let total = 0;
    for (let d = 1; d <= days; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      total += this.slotTimesForDate(iso).length;
    }
    return total;
  }
}
