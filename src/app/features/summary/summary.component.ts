/**
 * ============================================================================
 *  FILE: summary.component.ts  —  RIEPILOGO POST-ALLENAMENTO (feature)
 * ============================================================================
 *  SCOPO: schermata mostrata a fine sessione con durata, serie, esercizi,
 *    volume e XP guadagnati.
 *  FLUSSO DATI: ActiveWorkoutComponent chiama SessionService.finishSession(summary)
 *    e naviga qui → questo componente LEGGE state.summary() UNA volta (snapshot,
 *    non reattivo) → il getter items() costruisce le card → template.
 *  GUARDIA "soft": se summary è null (es. si arriva a /summary digitando l'URL),
 *    il constructor reindirizza a /home per non mostrare una pagina vuota.
 *  DIPENDENZE / USATO IN: rotta /summary. SessionService, Store, Router.
 *  DEBUG:
 *    - `r` è catturato nel campo all'init: se la sessione cambiasse dopo, questa
 *      vista NON si aggiorna (è voluto: è una "foto" del risultato).
 *    - toHome()/toProgress() chiamano clearSummary(): consumano il riepilogo
 *      così un successivo accesso diretto a /summary reindirizza correttamente.
 * ============================================================================
 */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TILE_CLASS } from '../../core/constants/ui.constants';
import { Accent } from '../../core/models/workout.models';
import { SessionService } from '../../core/services/session.service';
import { WorkoutStore } from '../../core/services/workout-store.service';

// Interfaccia locale per le card del riepilogo (durata, serie, esercizi, volume)
interface SummaryItem {
  ic: string;   // Classe CSS icona
  tile: Accent; // Colore del riquadro
  v: string;    // Valore (stringa formattata, es. "1:23" o "24/30")
  l: string;    // Label (es. "Durata", "Serie")
}

/**
 * Schermata di riepilogo post-allenamento.
 *
 * Legge il riepilogo dal SessionService (depositato da ActiveWorkoutComponent).
 * Se non c'è nessun riepilogo (navigazione diretta), reindirizza alla Home.
 */
@Component({
  selector: 'ff-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './summary.component.html',
})
export class SummaryComponent {
  readonly state = inject(SessionService);
  readonly w = inject(WorkoutStore);
  private readonly router = inject(Router);
  readonly TILE_CLASS = TILE_CLASS;

  // Legge il riepilogo dal signal del SessionService (non reattivo: solo lettura iniziale)
  // Se null, il costruttore reindirizza
  readonly r = this.state.summary();

  constructor() {
    // Se non c'è un riepilogo (es. l'utente naviga direttamente a /summary),
    // reindirizza alla Home per evitare una schermata vuota
    if (!this.r) {
      void this.router.navigate(['/home']);
    }
  }

  /** Formatta secondi come "m:ss". */
  fmt(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  }

  /**
   * Getter che costruisce l'array di card statistiche dal riepilogo.
   * Si accede come this.items nel template (senza parentesi — è un getter).
   */
  get items(): SummaryItem[] {
    const r = this.r;
    if (!r) {
      return [];
    }
    return [
      // toLocaleString('it-IT'): formatta il numero con separatori italiani (es. 1.234)
      { ic: 'ti-clock-hour-4', tile: 'cyan',   v: this.fmt(r.seconds),                 l: 'Durata' },
      { ic: 'ti-stretching',   tile: 'amber',  v: `${r.setsDone}/${r.setsTotal}`,       l: 'Serie' },
      { ic: 'ti-checklist',    tile: 'green',  v: `${r.exDone}/${r.exTotal}`,           l: 'Esercizi' },
      { ic: 'ti-weight',       tile: 'violet', v: r.volume.toLocaleString('it-IT'),     l: 'Volume (kg)' },
    ];
  }

  /** Torna alla Home e pulisce il riepilogo dal servizio. */
  toHome(): void {
    this.state.clearSummary();
    void this.router.navigate(['/home']);
  }

  /** Naviga ai progressi e pulisce il riepilogo. */
  toProgress(): void {
    this.state.clearSummary();
    void this.router.navigate(['/progress']);
  }
}
