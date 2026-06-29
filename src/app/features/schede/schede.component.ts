/**
 * ============================================================================
 *  FILE: schede.component.ts  —  LISTA SCHEDE con ricerca e filtri (feature)
 * ============================================================================
 *  SCOPO: catalogo delle schede; ricerca testuale + filtro per tipo/livello.
 *  COSA RAPPRESENTA: pagina del tab "Schede". Stato locale (q, filter) via
 *    signal; la lista filtrata è un computed → si aggiorna da sola quando
 *    cambiano query o filtro (niente handler manuali di "ricalcolo").
 *  FLUSSO DATI: store.schede + q() + filter() → computed `list` → template.
 *    Tap su una scheda → SessionService.openScheda() → /scheda/:id.
 *  DIPENDENZE / USATO IN: rotta /schede. Store, SessionService, DiffComponent.
 *  DEBUG: il filtro 'Veloce' è definito come durata ≤ 35 min (valore-soglia
 *    hardcoded qui); gli altri filtri confrontano LEVEL_LABEL[level]. Se un
 *    filtro "non trova nulla", verifica quella logica in `list`.
 * ============================================================================
 */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LEVEL_LABEL, TILE_CLASS } from '../../core/constants/ui.constants';
import { Scheda } from '../../core/models/workout.models';
import { SessionService } from '../../core/services/session.service';
import { WorkoutStore } from '../../core/services/workout-store.service';
import { DiffComponent } from '../../shared/components/diff/diff.component';

/**
 * Schermata "Schede" — lista delle schede disponibili con ricerca e filtri.
 *
 * Usa due signal locali (q, filter) per la ricerca/filtro.
 * Il signal `list` è un computed che reagisce automaticamente ai cambiamenti di
 * q() e filter() e filtra le schede di conseguenza.
 */
@Component({
  selector: 'ff-schede',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DiffComponent],
  templateUrl: './schede.component.html',
})
export class SchedeComponent {
  readonly w = inject(WorkoutStore);
  readonly state = inject(SessionService);
  private readonly router = inject(Router);

  readonly TILE_CLASS = TILE_CLASS;
  readonly LEVEL_LABEL = LEVEL_LABEL;

  // Array di filtri disponibili — mostrati come chip nella UI
  readonly filters = ['Tutti', 'Veloce', 'Principiante', 'Intermedio', 'Avanzato'];

  // Signal per il testo di ricerca (q = query)
  readonly q = signal('');
  // Signal per il filtro selezionato
  readonly filter = signal('Tutti');

  /**
   * Lista filtrata delle schede.
   * computed() si ricalcola automaticamente ogni volta che q() o filter() cambiano.
   * Nessun metodo manuale "onFilterChange" necessario — la reattività è automatica.
   */
  readonly list = computed<Scheda[]>(() => {
    const q = this.q().toLowerCase(); // toLowerCase per ricerca case-insensitive
    const f = this.filter();
    return this.w.schede.filter((s) => {
      // Controlla se la scheda matcha la query di ricerca (nome o focus)
      const matchQ = s.name.toLowerCase().includes(q) || s.focus.toLowerCase().includes(q);
      // Controlla se la scheda matcha il filtro selezionato
      const matchF =
        f === 'Tutti' ? true :                   // Nessun filtro
        f === 'Veloce' ? s.duration <= 35 :      // Durata ≤ 35 minuti
        LEVEL_LABEL[s.level] === f;              // Livello corrisponde all'etichetta
      return matchQ && matchF;
    });
  });

  /** Aggiorna il signal di ricerca ad ogni keystroke nell'input. */
  onSearch(e: Event): void {
    // e.target è il nodo DOM, castato a HTMLInputElement per accedere a .value
    this.q.set((e.target as HTMLInputElement).value);
  }

  /** Restituisce la classe CSS del badge in base al tag della scheda. */
  badgeClass(tag: string): string {
    return tag === 'In corso' ? 'badge-amber' : tag === 'Veloce' ? 'badge-green' : 'badge-violet';
  }

  go(route: string): void {
    void this.router.navigate(['/' + route]);
  }
}
