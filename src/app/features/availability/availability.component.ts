/**
 * ============================================================================
 *  FILE: availability.component.ts  —  QUANDO SEI DISPONIBILE (rotta /disponibilita)
 * ============================================================================
 *  SCOPO: le fasce orarie in cui accetti sedute col coach, la durata preferita,
 *    il recupero tra una seduta e l'altra e i giorni in cui non ci sei.
 *
 *  PERCHÉ STA NEL PROFILO E NON IN AGENDA: è una CONFIGURAZIONE, si tocca una
 *    volta ogni mesi. L'Agenda si apre ogni giorno per sapere cosa succede
 *    oggi. Tenerle nello stesso segment dava lo stesso peso a due cose con
 *    frequenze d'uso opposte, e rubava un terzo di una barra sempre visibile a
 *    una schermata di impostazioni.
 * ============================================================================
 */
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { AvailabilityService, DayAvailability } from '../../core/services/availability.service';
import { AppHeaderComponent } from '../../layout/app-header/app-header.component';

const GIORNI_BREVI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

@Component({
  selector: 'ff-availability',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppHeaderComponent],
  templateUrl: './availability.component.html',
  styleUrl: './availability.component.scss',
})
export class AvailabilityComponent {
  readonly avail = inject(AvailabilityService);
  private readonly location = inject(Location);

  readonly slotOpts = [45, 60];
  readonly bufferOpts = [0, 10, 15];
  readonly editDay = signal<number | null>(null);
  readonly newException = signal('');

  back(): void { this.location.back(); }

  daySummary(d: DayAvailability): string {
    if (!d.enabled) return 'Chiuso';
    if (!d.ranges.length) return '—';
    return d.ranges.map((r) => `${r.start}–${r.end}`).join(' · ');
  }

  toggleEditDay(i: number): void { this.editDay.update((c) => (c === i ? null : i)); }
  toggleDay(i: number): void { this.avail.toggleDay(i); }
  addRange(i: number): void { this.avail.addRange(i); }
  removeRange(i: number, idx: number): void { this.avail.removeRange(i, idx); }
  onStart(i: number, idx: number, ev: Event): void { this.avail.setStart(i, idx, (ev.target as HTMLInputElement).value); }
  onEnd(i: number, idx: number, ev: Event): void { this.avail.setEnd(i, idx, (ev.target as HTMLInputElement).value); }
  onException(ev: Event): void { this.newException.set((ev.target as HTMLInputElement).value); }
  addException(): void { this.avail.addException(this.newException(), true); this.newException.set(''); }
  removeException(id: string): void { this.avail.removeException(id); }

  dowShort(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    return `${GIORNI_BREVI[d.getDay()]} ${d.getDate()} ${MESI_BREVI[d.getMonth()]}`;
  }
}
