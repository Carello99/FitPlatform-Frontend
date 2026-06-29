/**
 * ============================================================================
 *  FILE: session.service.ts  —  ORCHESTRATORE DEL FLUSSO ALLENAMENTO
 * ============================================================================
 *
 * SCOPO DEL FILE
 *   Gestisce lo "stato di navigazione" del percorso di allenamento e fa da
 *   regista tra le schermate. Risponde alla domanda: "quale scheda sto
 *   guardando / eseguendo, e dove devo andare adesso?". Per uno sviluppatore
 *   Java: è un service che tiene lo stato conversazionale (tipo una sessione)
 *   e decide le transizioni, senza toccare la persistenza dei dati.
 *
 * DIFFERENZA CHIAVE CON WorkoutStore
 *   - WorkoutStore = COSA esiste (i dati: schede, utente...).
 *   - SessionService = DOVE sono nel flusso (selezione + navigazione).
 *   Non duplicare i dati qui: questo servizio tiene solo ID e flag di stato.
 *
 * FLUSSO DEI DATI / SCHERMATE
 *   Home (coverflow) → openScheda() → /scheda/:id (dettaglio) →
 *   beginSession() → /active (allenamento) → finishSession() → /summary.
 *   Uscita anticipata: exitSession() → /home. Avvio rapido dal FAB: startQuick().
 *   I componenti LEGGONO i signal (viewSchedaId, sessionSchedaId, summary...)
 *   e CHIAMANO i metodi di navigazione: tutta la regia delle rotte è qui.
 *
 * DIPENDENZE PRINCIPALI
 *   - Router: per navigare tra le rotte.
 *   - WorkoutStore: solo per risolvere un ID in una Scheda (activeScheda).
 *   - CHI LO USA: bottom-nav (FAB), home, scheda-detail, active-workout,
 *     summary, e activeSessionGuard (che legge hasActiveSession()).
 *
 * PUNTI CRITICI PER IL DEBUGGING
 *   - sessionSchedaId === null è la "verità" su sessione attiva: la guardia
 *     activeSessionGuard si basa su hasActiveSession(). Se /active reindirizza
 *     subito a casa, è perché questo signal è null.
 *   - summary viene riempito da finishSession() e va consumato/azzerato
 *     (clearSummary) dalla schermata Summary, altrimenti resta "appiccicato".
 *   - Lo stato è SOLO in memoria: un refresh del browser lo azzera (niente
 *     persistenza). È previsto, ma spiega perché /active dopo F5 torna a /home.
 * ============================================================================
 */

// computed: signal derivato (calcolato da altri signal)
// inject: dependency injection funzionale
// signal: crea un segnale reattivo con valore iniziale
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { WorkoutSummary } from '../models/workout.models';
import { WorkoutStore } from './workout-store.service';

/**
 * Servizio che gestisce il FLUSSO di navigazione tra le schermate dell'allenamento.
 *
 * Responsabilità:
 * - Tenere traccia di quale scheda è "attiva" (impostata come principale)
 * - Sapere quale scheda è in esecuzione (sessione in corso)
 * - Memorizzare il riepilogo dell'ultima sessione completata
 * - Navigare tra Home → Dettaglio → Allenamento attivo → Riepilogo
 *
 * Non gestisce dati API — quelli stanno in WorkoutStore.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly store = inject(WorkoutStore);
  private readonly router = inject(Router);

  // ---- Signal: contenitori di stato reattivo ----
  // Ogni signal è come una variabile "osservata": quando cambia,
  // tutti i componenti/computed che la leggono vengono aggiornati automaticamente.

  /** ID della scheda impostata come attiva (mostrata per prima nel coverflow). */
  readonly activeSchedaId = signal<string>('push');

  /** ID della scheda aperta nella schermata di dettaglio. */
  readonly viewSchedaId = signal<string | null>(null);

  /** Se true, la schermata di dettaglio apre automaticamente il dialog "Inizia allenamento". */
  readonly autoStartDialog = signal<boolean>(false);

  /** ID della scheda in esecuzione nell'allenamento attivo. null = nessuna sessione. */
  readonly sessionSchedaId = signal<string | null>(null);

  /** Riepilogo dell'ultima sessione completata, consumato dalla schermata Summary. */
  readonly summary = signal<WorkoutSummary | null>(null);

  /** Preferito per la scheda visualizzata nel dettaglio. */
  readonly fav = signal<boolean>(false);

  // computed(): derivato automaticamente da activeSchedaId() e store.
  // Si aggiorna ogni volta che activeSchedaId cambia.
  readonly activeScheda = computed(() => this.store.getScheda(this.activeSchedaId()));

  // ---- Metodi di navigazione ----

  /** Apre la schermata di dettaglio per una scheda. */
  openScheda(id: string, autoDialog = false): void {
    this.viewSchedaId.set(id);          // Aggiorna quale scheda è in dettaglio
    this.autoStartDialog.set(autoDialog); // Flag per aprire subito il dialog
    this.fav.set(false);                // Reset preferito
    // void davanti a navigate: ignora la Promise restituita (non ci interessa il risultato)
    void this.router.navigate(['/scheda', id]); // Naviga a /scheda/XXXX
  }

  /** Avvia una sessione di allenamento. */
  beginSession(id: string): void {
    this.sessionSchedaId.set(id); // Registra quale scheda è in esecuzione
    this.activeSchedaId.set(id);  // La imposta anche come scheda attiva
    this.autoStartDialog.set(false);
    void this.router.navigate(['/active']); // Naviga alla schermata di allenamento
  }

  /** Termina la sessione, salva il riepilogo e naviga al recap. */
  finishSession(summary: WorkoutSummary): void {
    this.summary.set(summary);      // Salva il riepilogo per la schermata Summary
    this.sessionSchedaId.set(null); // Nessuna sessione attiva
    void this.router.navigate(['/summary']);
  }

  /** Abbandona la sessione senza salvare. */
  exitSession(): void {
    this.sessionSchedaId.set(null);
    void this.router.navigate(['/home']);
  }

  /** Avvio rapido dal FAB della bottom nav: apre la scheda attiva o la lista schede. */
  startQuick(): void {
    const active = this.activeSchedaId();
    if (active) {
      this.openScheda(active, true); // Apre direttamente il dialog "Inizia"
    } else {
      void this.router.navigate(['/schede']);
    }
  }

  clearSummary(): void {
    this.summary.set(null);
  }

  /** Controlla se c'è una sessione di allenamento in corso. */
  hasActiveSession(): boolean {
    // !== null: il signal ha un ID (non null) → sessione attiva
    return this.sessionSchedaId() !== null;
  }
}
