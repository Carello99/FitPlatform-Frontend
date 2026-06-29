/**
 * ============================================================================
 *  FILE: home.component.ts  —  DASHBOARD / HOME (feature, componente "smart")
 * ============================================================================
 *  SCOPO: la schermata principale: saluto, recap settimanale, ring XP, frase
 *    motivazionale e il coverflow delle schede con avvio rapido.
 *  COSA RAPPRESENTA: componente "container/smart": conosce servizi e dati e li
 *    PASSA ai figli "dumb" (Coverflow, Ring, Diff) via @Input. Pattern smart vs
 *    presentational da tenere a mente leggendo il template.
 *  FLUSSO DATI: store (utente/schede/settimana) + SessionService (scheda attiva)
 *    → `carousel` (computed: scheda attiva per prima) alimenta il coverflow.
 *    (open)→openScheda()→/scheda/:id; (start)→mini-dialog→beginSession()→/active.
 *  DIPENDENZE / USATO IN: rotta /home. Store, SessionService, Router.
 *  DEBUG:
 *    - weekPct e xpPct sono calcolati nell'INIZIALIZZAZIONE del campo (una volta):
 *      leggono store.user/weekDone. Funzionano perché la shell monta la Home solo
 *      a dati pronti (gate loading). Se store fosse vuoto qui → divisioni su dati
 *      mancanti; xpPct NON ha guardia /0 (assume xpNext>0 dai dati reali).
 *    - `carousel` invece è reattivo: si riordina quando cambia la scheda attiva.
 * ============================================================================
 */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ACCENT_VAR, LEVEL_LABEL, MOTIVATION, TILE_CLASS } from '../../core/constants/ui.constants';
import { Scheda } from '../../core/models/workout.models';
import { SessionService } from '../../core/services/session.service';
import { WorkoutStore } from '../../core/services/workout-store.service';
import { RingComponent } from '../../shared/components/ring/ring.component';
import { DiffComponent } from '../../shared/components/diff/diff.component';
import { CoverflowComponent } from './coverflow.component';

/**
 * Dashboard principale — il cuore dell'app.
 *
 * Componente "smart" (o "container"): conosce i servizi e i dati.
 * I componenti figli (CoverflowComponent, RingComponent, ecc.) sono
 * "presentazionali": ricevono dati via @Input e non conoscono i servizi.
 *
 * Il template HTML è in home.component.html (templateUrl).
 */
@Component({
  selector: 'ff-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Tutti i componenti usati nel template devono essere qui negli imports
  imports: [RingComponent, DiffComponent, CoverflowComponent],
  // templateUrl: il template è in un file .html separato (per componenti con HTML lungo)
  templateUrl: './home.component.html',
})
export class HomeComponent {
  // Servizi iniettati — sono "readonly" per chiarire che non vengono mai riassegnati
  readonly w = inject(WorkoutStore);
  readonly state = inject(SessionService);
  private readonly router = inject(Router);

  // Costanti esposte come proprietà del componente per usarle nel template HTML.
  // Nel template non si può importare direttamente da altri moduli,
  // quindi si "passa" la costante come proprietà.
  readonly ACCENT_VAR = ACCENT_VAR;
  readonly TILE_CLASS = TILE_CLASS;
  readonly LEVEL_LABEL = LEVEL_LABEL;

  // Signal locale: la scheda selezionata nel mini-dialog di avvio rapido
  readonly startTarget = signal<Scheda | null>(null);

  // Frase motivazionale del giorno — cambia in base al giorno della settimana
  // getDay() restituisce 0=Dom, 1=Lun, ..., 6=Sab
  readonly motiv = MOTIVATION[new Date().getDay() % MOTIVATION.length];

  // Calcoli per la progress bar settimanale e la ring XP.
  // Getter (non campi): si rileggono a ogni render, così dopo un allenamento la
  // gamification aggiorna lo Store e questi valori riflettono subito i nuovi dati.
  get weekPct(): number {
    return Math.round((this.w.weekDone / Math.max(this.w.weekGoal, 1)) * 100);
  }
  get xpPct(): number {
    return this.w.user.xpNext > 0 ? this.w.user.xp / this.w.user.xpNext : 0; // 0..1
  }

  /**
   * Lista ordinata delle schede per il coverflow:
   * la scheda attiva per prima, poi tutte le altre.
   *
   * computed(): si ricalcola automaticamente ogni volta che activeSchedaId() cambia.
   */
  readonly carousel = computed<Scheda[]>(() => {
    const active = this.state.activeSchedaId();
    return [
      ...this.w.schede.filter((s) => s.id === active),    // Scheda attiva prima
      ...this.w.schede.filter((s) => s.id !== active),    // Poi le altre
      // ... (spread operator): "spiatta" l'array — unisce i due array in uno
    ];
  });

  /** Naviga a una route. */
  go(route: string): void {
    void this.router.navigate(['/' + route]);
  }

  /** Delegato al WorkoutStore per calcolare le serie totali. */
  totalSets(s: Scheda): number {
    return this.w.totalSets(s);
  }

  /** Avvia l'allenamento per la scheda selezionata nel dialog. */
  confirmStart(): void {
    const s = this.startTarget();
    if (s) {
      this.state.beginSession(s.id);
    }
  }

  /** Chiude il dialog e naviga al dettaglio della scheda. */
  toDetail(): void {
    const s = this.startTarget();
    if (s) {
      this.startTarget.set(null); // Chiude il dialog
      this.state.openScheda(s.id);
    }
  }
}
