/**
 * ============================================================================
 *  FILE: history.component.ts  —  SCHERMATA STORICO ALLENAMENTI (feature)
 * ============================================================================
 *  SCOPO: lista degli allenamenti passati con una banda di statistiche in cima.
 *  COSA RAPPRESENTA: pagina di sola lettura. Legge store.history e lo mostra.
 *  FLUSSO DATI: store.history (HistoryItem[]) → template.
 *  DIPENDENZE / USATO IN: rotta /history (raggiungibile dal tab Profilo).
 *  DEBUG / NOTA: i chip `filters` e il signal `filter` sono solo UI: il
 *    FILTRAGGIO NON è implementato (la lista mostrata è sempre quella completa).
 *    Anche i valori di `band` sono statici/placeholder, non calcolati dai dati.
 * ============================================================================
 */
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TILE_CLASS } from '../../core/constants/ui.constants';
import { WorkoutStore } from '../../core/services/workout-store.service';

/**
 * Schermata storico degli allenamenti.
 * Semplice lista con filtri rapidi (non ancora implementati — mostrano solo la lista completa).
 */
@Component({
  selector: 'ff-history',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './history.component.html',
})
export class HistoryComponent {
  readonly w = inject(WorkoutStore);
  private readonly router = inject(Router);
  readonly TILE_CLASS = TILE_CLASS;

  // Filtri disponibili per la lista storico
  readonly filters = ['Tutti', 'Questa sett.', 'Questo mese'];

  // Signal per il filtro selezionato (usato solo per la UI — il filtraggio non è implementato)
  readonly filter = signal('Tutti');

  // Array di coppie [valore, etichetta] per le statistiche in cima alla pagina
  // Notazione TypeScript: [string, string][] → array di tuple con esattamente 2 stringhe
  readonly band: [string, string][] = [
    ['142', 'Totali'],
    ['168h', 'Tempo'],
    ['12', 'Streak'],
  ];

  back(): void {
    void this.router.navigate(['/home']);
  }
}
